package handler

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestServeUploadFormatWhitelist(t *testing.T) {
	uploadDir := t.TempDir()
	h := &FileHandler{UploadDir: uploadDir}

	writeTestFile := func(name, content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(uploadDir, name), []byte(content), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}

	doGet := func(name string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/uploads/"+name, nil)
		w := httptest.NewRecorder()
		h.Serve(w, req)
		return w
	}

	kkFileViewFormats := []string{
		"a.png", "a.ico", "a.jfif", "a.pdf", "a.ofd", "a.tif", "a.tiff",
		"a.docx", "a.wps", "a.docm", "a.xlsm", "a.xltx", "a.et", "a.ods", "a.tsv",
		"a.dps", "a.odp", "a.rtf", "a.vsd", "a.vsdx", "a.wmf", "a.psd", "a.eps",
		"a.zip", "a.jar", "a.tar", "a.gzip", "a.rar", "a.7z",
		"a.dwg", "a.dxf", "a.dwf", "a.dwfx", "a.dwt", "a.dng", "a.cf2", "a.plt",
		"a.stl", "a.obj", "a.3ds", "a.ply", "a.off", "a.3dm", "a.fbx", "a.dae",
		"a.wrl", "a.3mf", "a.glb", "a.gltf", "a.o3dv", "a.stp", "a.step", "a.iges",
		"a.igs", "a.brep", "a.bim", "a.fcstd", "a.ifc",
		"a.mp3", "a.m4a", "a.flv", "a.mpeg", "a.mpd", "a.m3u8", "a.ts",
		"a.avi", "a.mov", "a.wmv", "a.mkv", "a.3gp", "a.rm",
		"a.md", "a.log", "a.json", "a.properties", "a.yaml", "a.yml", "a.gitignore",
		"a.java", "a.py", "a.c", "a.cpp", "a.h", "a.php", "a.go", "a.js", "a.css",
		"a.lua", "a.sh", "a.rb", "a.sql", "a.bat", "a.m", "a.bas", "a.prg", "a.cmd",
		"a.cs", "a.ftl", "a.asp", "a.jsp", "a.aspx",
		"a.eml", "a.xmind", "a.epub", "a.dcm", "a.drawio", "a.bpmn",
	}
	for _, name := range kkFileViewFormats {
		writeTestFile(name, "test")
		if w := doGet(name); w.Code != http.StatusOK {
			t.Errorf("GET %s = %d, want 200", name, w.Code)
		}
	}
}

func TestServeUploadRejectsUnlistedFormats(t *testing.T) {
	uploadDir := t.TempDir()
	h := &FileHandler{UploadDir: uploadDir}

	for _, name := range []string{"a.exe", "a.dll", "a.dat", "a.exe.jsx", "a.dmg"} {
		if err := os.WriteFile(filepath.Join(uploadDir, name), []byte("x"), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
		req := httptest.NewRequest(http.MethodGet, "/uploads/"+name, nil)
		w := httptest.NewRecorder()
		h.Serve(w, req)
		if w.Code != http.StatusForbidden {
			t.Errorf("GET %s = %d, want 403", name, w.Code)
		}
	}
}

func TestServeUploadXssRiskyTypesGetSandboxHeaders(t *testing.T) {
	uploadDir := t.TempDir()
	h := &FileHandler{UploadDir: uploadDir}

	risky := []string{"a.html", "a.htm", "a.svg", "a.xml", "a.xbrl"}
	for _, name := range risky {
		if err := os.WriteFile(filepath.Join(uploadDir, name), []byte("x"), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
		req := httptest.NewRequest(http.MethodGet, "/uploads/"+name, nil)
		w := httptest.NewRecorder()
		h.Serve(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("GET %s = %d, want 200", name, w.Code)
			continue
		}
		if got := w.Header().Get("Content-Security-Policy"); got != "sandbox" {
			t.Errorf("GET %s CSP = %q, want sandbox", name, got)
		}
		if got := w.Header().Get("X-Content-Type-Options"); got != "nosniff" {
			t.Errorf("GET %s X-Content-Type-Options = %q, want nosniff", name, got)
		}
	}

	if err := os.WriteFile(filepath.Join(uploadDir, "a.txt"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write a.txt: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/uploads/a.txt", nil)
	w := httptest.NewRecorder()
	h.Serve(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GET a.txt = %d, want 200", w.Code)
	}
	if got := w.Header().Get("Content-Security-Policy"); got != "" {
		t.Errorf("GET a.txt CSP = %q, want empty", got)
	}
	body, _ := io.ReadAll(w.Result().Body)
	if string(body) != "x" {
		t.Errorf("GET a.txt body = %q, want x", string(body))
	}
}
