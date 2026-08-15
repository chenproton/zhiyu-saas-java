package middleware

import (
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

var moduleNames = map[string]string{
	"tenants":               "租户管理",
	"organizations":         "组织架构",
	"org-types":             "组织类型",
	"users":                 "用户管理",
	"staff-titles":          "教职工职称",
	"user-extension-fields": "用户扩展字段",
	"user-relations":        "用户关系",
	"roles":                 "角色权限",
	"majors":                "专业管理",
	"industries":            "行业管理",
	"resource-codes":        "资源代码",
	"subscriptions":         "订阅管理",
	"workflows":             "工作流",
	"approvals":             "审批管理",
	"job":                   "岗位管理",
	"scene":                 "场景实训",
	"lesson":                "课程教学",
	"evaluation":            "考核评价",
	"resources":             "资源管理",
	"institutions":          "机构管理",
	"orders":                "订单管理",
	"withdrawals":           "提现管理",
	"banners":               "轮播图",
	"files":                 "文件管理",
	"config":                "系统配置",
	"import":                "数据导入",
	"export":                "数据导出",
}

var actionNames = map[string]string{
	"status":         "状态变更",
	"review":         "审核",
	"publish":        "发布",
	"submit":         "提交审核",
	"archive":        "归档",
	"withdraw":       "撤回",
	"invite":         "邀请",
	"assign":         "分配",
	"reset-password": "重置密码",
	"approve":        "审核通过",
	"disable":        "禁用",
	"pay":            "支付",
	"grade":          "评分",
	"batch-grade":    "批量评分",
	"toggle":         "切换状态",
	"start":          "开始",
	"finish":         "结束",
	"reorder":        "排序",
	"process":        "处理",
	"apply":          "申请",
	"generate":       "生成",
	"issue":          "发放",
	"batch":          "批量创建",
	"upload":         "上传",
}

var opLogSkips = []string{"/behavior-collection/", "/view"}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (sr *statusRecorder) WriteHeader(code int) {
	sr.status = code
	sr.ResponseWriter.WriteHeader(code)
}

// Flush 透传底层 http.Flusher：SSE 流式端点（AI 智能服务中心对话）经本中间件时
// 不能丢失 Flush 能力，否则流式降级为 500（"streaming unsupported"）。
func (sr *statusRecorder) Flush() {
	if f, ok := sr.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Unwrap 支持 http.ResponseController 取到底层 writer（Flusher/Hijacker 等能力探测）。
func (sr *statusRecorder) Unwrap() http.ResponseWriter {
	return sr.ResponseWriter
}

// ClientIP 获取客户端真实 IP。
// 后端仅暴露于内网并经 nginx 网关转发（网关已透传 X-Real-IP / X-Forwarded-For），
// 故当直接连接方为回环/内网地址时优先取 X-Forwarded-For 首个地址，其次 X-Real-IP，
// 最后回退 RemoteAddr；直连方为公网地址时（理论上不可达）不回退代理头，防伪造。
func ClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(strings.Trim(host, "[]"))
	if ip == nil || (!ip.IsLoopback() && !ip.IsPrivate()) {
		return host
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for _, part := range strings.Split(xff, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			if p := net.ParseIP(strings.Trim(part, "[]")); p != nil {
				return part
			}
		}
	}
	if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
		if p := net.ParseIP(strings.Trim(xri, "[]")); p != nil {
			return xri
		}
	}
	return host
}

func OperationLog(db *pgxpool.Pool, buffer *OpLogBuffer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost && r.Method != http.MethodPut && r.Method != http.MethodDelete {
				next.ServeHTTP(w, r)
				return
			}
			for _, skip := range opLogSkips {
				if strings.Contains(r.URL.Path, skip) {
					next.ServeHTTP(w, r)
					return
				}
			}

			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)

			claims := CurrentUser(r)
			if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
				return
			}

			module, action, targetType, targetID := describeOperation(r.Method, r.URL.Path)
			status := "success"
			if rec.status >= 400 {
				status = "failed"
			}
			detail := r.Method + " " + r.URL.Path

			userName := claims.Username

			if buffer != nil {
				buffer.Enqueue(OpLogEntry{
					TenantID:   *claims.TenantID,
					UserID:     claims.UserID,
					UserName:   userName,
					Module:     module,
					Action:     action,
					TargetType: targetType,
					TargetID:   targetID,
					Detail:     detail,
					IP:         ClientIP(r),
					Status:     status,
				})
			} else {
				_, err := db.Exec(r.Context(), `
				INSERT INTO operation_logs (tenant_id, user_id, user_name, module, action, target_type, target_id, detail, ip, status)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			`, *claims.TenantID, claims.UserID, userName, module, action, targetType, targetID, detail, ClientIP(r), status)
				if err != nil {
					slog.Warn("failed to record operation log", "userId", claims.UserID, "error", err)
				}
			}
		})
	}
}

func describeOperation(method, path string) (module, action string, targetType, targetID *string) {
	trimmed := strings.TrimPrefix(path, "/api/v1/")
	segments := []string{}
	for _, seg := range strings.Split(trimmed, "/") {
		if seg != "" {
			segments = append(segments, seg)
		}
	}
	if len(segments) == 0 {
		return trimmed, methodAction(method), nil, nil
	}

	module = segments[0]
	if name, ok := moduleNames[module]; ok {
		module = name
	}

	last := segments[len(segments)-1]
	prevType := ""
	for i, seg := range segments {
		if uuidPattern.MatchString(seg) {
			id := seg
			targetID = &id
			if i > 0 {
				prevType = segments[i-1]
				targetType = &prevType
			}
			break
		}
	}

	if name, ok := actionNames[last]; ok && !uuidPattern.MatchString(last) {
		action = name
	} else {
		action = methodAction(method)
	}
	return module, action, targetType, targetID
}

func methodAction(method string) string {
	switch method {
	case http.MethodPost:
		return "创建"
	case http.MethodPut:
		return "更新"
	case http.MethodDelete:
		return "删除"
	default:
		return method
	}
}
