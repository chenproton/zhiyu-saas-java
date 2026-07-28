package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type OrderHandler struct {
	DB *pgxpool.Pool
}

type OrderListResponse struct {
	Items []domain.Order `json:"items"`
	Total int            `json:"total"`
}

type CreateOrderRequest struct {
	ResourceID string `json:"resourceId"`
}

type OrderDetailResponse struct {
	Order         domain.Order          `json:"order"`
	Buyer         domain.Institution    `json:"buyer"`
	Seller        domain.Institution    `json:"seller"`
	Resource      domain.Resource       `json:"resource"`
	Authorization *domain.Authorization `json:"authorization,omitempty"`
}

type AuthorizationListResponse struct {
	Items []AuthorizationDetail `json:"items"`
	Total int                   `json:"total"`
}

type AuthorizationDetail struct {
	domain.Authorization
	ResourceName string `json:"resourceName"`
	SellerName   string `json:"sellerName"`
}

func generateOrderNo() string {
	return fmt.Sprintf("ORD-%s-%s", time.Now().Format("20060102"), uuid.NewString()[:8])
}

func generateAuthCode() string {
	return "AUTH-" + strings.ToUpper(uuid.NewString()[:4]+"-"+uuid.NewString()[:4]+"-"+uuid.NewString()[:4])
}

func (h *OrderHandler) List(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")

	items, total, err := executeListQuery(r.Context(), h.DB, r, listQueryConfig[domain.Order]{
		Table:         "orders",
		SelectColumns: "id, order_no, buyer_id, seller_id, resource_id, price, platform_fee, seller_income, status, paid_at, created_at",
		TenantScoped:  false,
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
			claims := middleware.CurrentUser(r)
			if claims != nil && !platformAdminOnly(claims) && claims.InstitutionID != nil {
				ph := qb.nextArg(*claims.InstitutionID)
				qb.addCondition("(buyer_id = " + ph + " OR seller_id = " + ph + ")")
			}
		},
		ScanRows: h.scanOrderRows,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询订单失败")
		return
	}

	respondJSON(w, http.StatusOK, OrderListResponse{Items: items, Total: total})
}

func (h *OrderHandler) scanOrderRows(rows pgx.Rows) ([]domain.Order, error) {
	items := make([]domain.Order, 0)
	for rows.Next() {
		var o domain.Order
		if err := rows.Scan(&o.ID, &o.OrderNo, &o.BuyerID, &o.SellerID, &o.ResourceID, &o.Price, &o.PlatformFee, &o.SellerIncome, &o.Status, &o.PaidAt, &o.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, o)
	}
	return items, nil
}

func (h *OrderHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	id := chi.URLParam(r, "id")

	order, detail, err := h.fetchOrderDetail(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "订单不存在")
		return
	}

	if !platformAdminOnly(claims) && claims.InstitutionID != nil &&
		order.BuyerID != *claims.InstitutionID && order.SellerID != *claims.InstitutionID {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	respondJSON(w, http.StatusOK, detail)
}

func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims.InstitutionID == nil {
		respondError(w, http.StatusForbidden, "用户未关联机构")
		return
	}

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	// Fetch resource
	var res struct {
		InstitutionID string
		Price         float64
		Status        string
	}
	err := h.DB.QueryRow(r.Context(), `SELECT institution_id, price, status FROM resources WHERE id = $1`, req.ResourceID).Scan(
		&res.InstitutionID, &res.Price, &res.Status)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源不存在")
		return
	}
	if res.Status != string(domain.ResourceStatusPublished) {
		respondError(w, http.StatusBadRequest, "资源不可购买")
		return
	}
	if res.InstitutionID == *claims.InstitutionID {
		respondError(w, http.StatusBadRequest, "不能购买自己的资源")
		return
	}

	// Check existing authorization
	var existing int
	_ = h.DB.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM authorizations WHERE buyer_id = $1 AND resource_id = $2
	`, *claims.InstitutionID, req.ResourceID).Scan(&existing)
	if existing > 0 {
		respondError(w, http.StatusBadRequest, "已购买")
		return
	}

	// Get platform fee rate
	feeRate := 0.15
	_ = h.DB.QueryRow(r.Context(), `SELECT value::float FROM platform_configs WHERE key = 'platform_fee_rate'`).Scan(&feeRate)

	platformFee := res.Price * feeRate
	sellerIncome := res.Price - platformFee

	id := uuid.NewString()
	orderNo := generateOrderNo()

	_, err = h.DB.Exec(r.Context(), `
		INSERT INTO orders (id, order_no, buyer_id, seller_id, resource_id, price, platform_fee, seller_income, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
	`, id, orderNo, *claims.InstitutionID, res.InstitutionID, req.ResourceID, res.Price, platformFee, sellerIncome)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建订单失败")
		return
	}

	_, detail, _ := h.fetchOrderDetail(r.Context(), id)
	respondJSON(w, http.StatusCreated, detail)
}

func (h *OrderHandler) Pay(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	id := chi.URLParam(r, "id")

	order, _, err := h.fetchOrderDetail(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "订单不存在")
		return
	}

	if claims.InstitutionID == nil || order.BuyerID != *claims.InstitutionID {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if order.Status != domain.OrderStatusPending {
		respondError(w, http.StatusBadRequest, "订单无法支付")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	paidAt := time.Now()
	_, err = tx.Exec(r.Context(), `
		UPDATE orders SET status = 'paid', paid_at = $1 WHERE id = $2
	`, paidAt, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新订单失败")
		return
	}

	// Update seller balance and income
	_, err = tx.Exec(r.Context(), `
		UPDATE institutions SET balance = balance + $1, total_income = total_income + $1 WHERE id = $2
	`, order.SellerIncome, order.SellerID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新卖家失败")
		return
	}

	// Update buyer total spent
	_, err = tx.Exec(r.Context(), `
		UPDATE institutions SET total_spent = total_spent + $1 WHERE id = $2
	`, order.Price, order.BuyerID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新买家失败")
		return
	}

	// Increment resource sales count
	_, err = tx.Exec(r.Context(), `
		UPDATE resources SET sales_count = sales_count + 1 WHERE id = $1
	`, order.ResourceID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新资源销售失败")
		return
	}

	// Create authorization
	authID := "auth-" + uuid.NewString()
	authCode := generateAuthCode()
	_, err = tx.Exec(r.Context(), `
		INSERT INTO authorizations (id, order_id, buyer_id, resource_id, auth_code, status, created_at)
		VALUES ($1, $2, $3, $4, $5, 1, NOW())
	`, authID, id, order.BuyerID, order.ResourceID, authCode)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建授权失败")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	order, detail, _ := h.fetchOrderDetail(r.Context(), id)
	respondJSON(w, http.StatusOK, detail)
}

func (h *OrderHandler) ListAuthorizations(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if !platformAdminOnly(claims) && claims.InstitutionID != nil {
		where = append(where, "a.buyer_id = $"+itoa(argIdx))
		args = append(args, *claims.InstitutionID)
		argIdx++
	}

	countQuery := `
		SELECT COUNT(*) FROM authorizations a
		JOIN resources r ON r.id = a.resource_id
		WHERE ` + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT a.id, a.order_id, a.buyer_id, a.resource_id, a.auth_code, a.status, a.created_at,
			r.name, i.name
		FROM authorizations a
		JOIN resources r ON r.id = a.resource_id
		JOIN institutions i ON i.id = r.institution_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY a.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询授权记录失败")
		return
	}
	defer rows.Close()

	items := make([]AuthorizationDetail, 0)
	for rows.Next() {
		var d AuthorizationDetail
		if err := rows.Scan(&d.ID, &d.OrderID, &d.BuyerID, &d.ResourceID, &d.AuthCode, &d.Status, &d.CreatedAt,
			&d.ResourceName, &d.SellerName); err != nil {
			respondError(w, http.StatusInternalServerError, "读取授权记录失败")
			return
		}
		items = append(items, d)
	}

	respondJSON(w, http.StatusOK, AuthorizationListResponse{Items: items, Total: total})
}

func (h *OrderHandler) VerifyAuthorization(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	code := chi.URLParam(r, "code")

	var auth domain.Authorization
	var resourceInstitutionID string
	err := h.DB.QueryRow(r.Context(), `
		SELECT a.id, a.order_id, a.buyer_id, a.resource_id, a.auth_code, a.status, a.created_at, r.institution_id
		FROM authorizations a
		JOIN resources r ON r.id = a.resource_id
		WHERE a.auth_code = $1
	`, code).Scan(&auth.ID, &auth.OrderID, &auth.BuyerID, &auth.ResourceID, &auth.AuthCode, &auth.Status, &auth.CreatedAt, &resourceInstitutionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "无效授权码")
		return
	}

	// Only operator or seller can verify
	if !platformAdminOnly(claims) && (claims.InstitutionID == nil || *claims.InstitutionID != resourceInstitutionID) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	respondJSON(w, http.StatusOK, auth)
}

func (h *OrderHandler) fetchOrderDetail(ctx context.Context, id string) (domain.Order, *OrderDetailResponse, error) {
	var order domain.Order
	err := h.DB.QueryRow(ctx, `
		SELECT id, order_no, buyer_id, seller_id, resource_id, price, platform_fee, seller_income, status, paid_at, created_at
		FROM orders WHERE id = $1
	`, id).Scan(&order.ID, &order.OrderNo, &order.BuyerID, &order.SellerID, &order.ResourceID, &order.Price,
		&order.PlatformFee, &order.SellerIncome, &order.Status, &order.PaidAt, &order.CreatedAt)
	if err != nil {
		return order, nil, err
	}

	var buyer, seller domain.Institution
	var resource domain.Resource

	_ = h.DB.QueryRow(ctx, `SELECT id, type, name, credit_code, logo, intro, contact_name, contact_phone, contact_email, qualification_file, status, org_code, balance, total_spent, total_income, created_at, updated_at FROM institutions WHERE id = $1`, order.BuyerID).Scan(
		&buyer.ID, &buyer.Type, &buyer.Name, &buyer.CreditCode, &buyer.Logo, &buyer.Intro, &buyer.ContactName, &buyer.ContactPhone, &buyer.ContactEmail, &buyer.QualificationFile, &buyer.Status, &buyer.OrgCode, &buyer.Balance, &buyer.TotalSpent, &buyer.TotalIncome, &buyer.CreatedAt, &buyer.UpdatedAt)
	_ = h.DB.QueryRow(ctx, `SELECT id, type, name, credit_code, logo, intro, contact_name, contact_phone, contact_email, qualification_file, status, org_code, balance, total_spent, total_income, created_at, updated_at FROM institutions WHERE id = $1`, order.SellerID).Scan(
		&seller.ID, &seller.Type, &seller.Name, &seller.CreditCode, &seller.Logo, &seller.Intro, &seller.ContactName, &seller.ContactPhone, &seller.ContactEmail, &seller.QualificationFile, &seller.Status, &seller.OrgCode, &seller.Balance, &seller.TotalSpent, &seller.TotalIncome, &seller.CreatedAt, &seller.UpdatedAt)
	_ = h.DB.QueryRow(ctx, `SELECT id, institution_id, name, intro, category, cover_image, attachment, attachment_name, price, version, status, reject_reason, sales_count, (SELECT COUNT(*) FROM view_logs WHERE target_type = 'resource' AND target_id = id) AS view_count, created_at, updated_at FROM resources WHERE id = $1`, order.ResourceID).Scan(
		&resource.ID, &resource.InstitutionID, &resource.Name, &resource.Intro, &resource.Category, &resource.CoverImage, &resource.Attachment, &resource.AttachmentName, &resource.Price, &resource.Version, &resource.Status, &resource.RejectReason, &resource.SalesCount, &resource.ViewCount, &resource.CreatedAt, &resource.UpdatedAt)

	var auth *domain.Authorization
	if order.Status == domain.OrderStatusPaid {
		var a domain.Authorization
		if err := h.DB.QueryRow(ctx, `SELECT id, order_id, buyer_id, resource_id, auth_code, status, created_at FROM authorizations WHERE order_id = $1`, order.ID).Scan(
			&a.ID, &a.OrderID, &a.BuyerID, &a.ResourceID, &a.AuthCode, &a.Status, &a.CreatedAt); err == nil {
			auth = &a
		}
	}

	detail := &OrderDetailResponse{
		Order:         order,
		Buyer:         buyer,
		Seller:        seller,
		Resource:      resource,
		Authorization: auth,
	}
	return order, detail, nil
}

func (h *OrderHandler) updateOrderStatus(ctx context.Context, tx pgx.Tx, id string, status domain.OrderStatus) error {
	_, err := tx.Exec(ctx, `UPDATE orders SET status = $1 WHERE id = $2`, status, id)
	return err
}
