package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// FavoritesHandler 通用收藏（场景/课程/题库/试卷）HTTP 适配。
type FavoritesHandler struct {
	Service *service.FavoritesService
}

// FavoriteListResponse 收藏列表响应（岗位收藏仍走 /job/positions/favorites）。
type FavoriteListResponse struct {
	Scenes        []domain.Scenario     `json:"scene"`
	Courses       []domain.Course       `json:"course"`
	QuestionBanks []domain.QuestionBank `json:"question_bank"`
	Exams         []domain.Exam         `json:"exam"`
}

// GetFavorite 查询收藏状态。
func (h *FavoritesHandler) GetFavorite(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "请先登录")
		return
	}
	targetType := chi.URLParam(r, "targetType")
	if !store.ValidFavoriteType(targetType) {
		respondError(w, http.StatusBadRequest, "不支持的收藏类型")
		return
	}
	id := chi.URLParam(r, "id")
	isfav, err := h.Service.GetFavorite(r.Context(), claims.UserID, targetType, id)
	if err != nil {
		respondServerError(w, r, err, "查询收藏状态失败")
		return
	}
	cnt, _ := h.Service.FavoriteCount(r.Context(), targetType, id)
	respondJSON(w, http.StatusOK, FavoriteStatusResponse{IsFavorite: isfav, FavoriteCount: cnt})
}

// ToggleFavorite 切换收藏，返回新状态。
func (h *FavoritesHandler) ToggleFavorite(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "请先登录")
		return
	}
	targetType := chi.URLParam(r, "targetType")
	if !store.ValidFavoriteType(targetType) {
		respondError(w, http.StatusBadRequest, "不支持的收藏类型")
		return
	}
	id := chi.URLParam(r, "id")
	isfav, err := h.Service.ToggleFavorite(r.Context(), claims.UserID, targetType, id)
	if err != nil {
		respondServerError(w, r, err, "切换收藏失败")
		return
	}
	cnt, _ := h.Service.FavoriteCount(r.Context(), targetType, id)
	respondJSON(w, http.StatusOK, FavoriteStatusResponse{IsFavorite: isfav, FavoriteCount: cnt})
}

// List 查询当前用户全部收藏（按类型分组）。
func (h *FavoritesHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "请先登录")
		return
	}

	ctx := r.Context()
	userID := claims.UserID
	scenes, err := h.Service.ListScenes(ctx, userID)
	if err != nil {
		respondServerError(w, r, err, "查询收藏场景失败")
		return
	}
	courses, err := h.Service.ListCourses(ctx, userID)
	if err != nil {
		respondServerError(w, r, err, "查询收藏课程失败")
		return
	}
	banks, err := h.Service.ListQuestionBanks(ctx, userID)
	if err != nil {
		respondServerError(w, r, err, "查询收藏题库失败")
		return
	}
	exams, err := h.Service.ListExams(ctx, userID)
	if err != nil {
		respondServerError(w, r, err, "查询收藏试卷失败")
		return
	}
	respondJSON(w, http.StatusOK, FavoriteListResponse{
		Scenes:        scenes,
		Courses:       courses,
		QuestionBanks: banks,
		Exams:         exams,
	})
}
