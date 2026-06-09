package backend

import (
	"ant-chrome/backend/internal/logger"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// GetDataStoragePath 返回当前数据存储路径（绝对路径）。
func (a *App) GetDataStoragePath() string {
	root := strings.TrimSpace(a.config.Browser.UserDataRoot)
	if root == "" {
		root = "data"
	}
	abs := a.resolveAppPath(root)
	return abs
}

// SetDataStoragePath 修改数据存储路径并持久化到 config.yaml。
// 传入空字符串恢复默认值 "data"。
func (a *App) SetDataStoragePath(newPath string) error {
	log := logger.New("DataStorage")

	newPath = strings.TrimSpace(newPath)
	if newPath == "" {
		newPath = "data"
	}

	// 如果是绝对路径，检查是否存在；相对路径自动相对于 appRoot
	if filepath.IsAbs(newPath) {
		if err := os.MkdirAll(newPath, 0o755); err != nil {
			return fmt.Errorf("创建目录失败: %w", err)
		}
	} else {
		abs := a.resolveAppPath(newPath)
		if err := os.MkdirAll(abs, 0o755); err != nil {
			return fmt.Errorf("创建目录失败: %w", err)
		}
	}

	a.config.Browser.UserDataRoot = newPath
	if err := a.config.Save(a.resolveAppPath("config.yaml")); err != nil {
		log.Error("保存配置失败", logger.F("error", err))
		return fmt.Errorf("保存配置失败: %w", err)
	}
	log.Info("数据存储路径已更新", logger.F("path", newPath))
	return nil
}

// BrowseDataStorageDirectory 打开文件夹选择对话框，返回用户选择的路径。
// 返回空字符串表示用户取消。
func (a *App) BrowseDataStorageDirectory() string {
	if a.ctx == nil {
		return ""
	}
	dir, err := wailsruntime.OpenDirectoryDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "选择数据存储目录",
	})
	if err != nil {
		return ""
	}
	return strings.TrimSpace(dir)
}
