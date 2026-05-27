package backend

import (
	"ant-chrome/backend/internal/browser"
	"ant-chrome/backend/internal/config"
	"fmt"
	"strings"
	"time"
)

func tryCloseBrowserViaCDP(debugPort int, timeout time.Duration) bool {
	if debugPort <= 0 || !canConnectDebugPort(debugPort, 250*time.Millisecond) {
		return false
	}

	_ = cdpBrowserCall(debugPort, "Browser.close", nil)
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if !canConnectDebugPort(debugPort, 250*time.Millisecond) {
			return true
		}
		time.Sleep(150 * time.Millisecond)
	}
	return false
}

func normalizeNonEmptyStrings(items []string) []string {
	if len(items) == 0 {
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		value := strings.TrimSpace(item)
		if value != "" {
			out = append(out, value)
		}
	}
	return out
}

func ensureNewWindowLaunchArg(args []string) []string {
	for _, arg := range args {
		if strings.EqualFold(strings.TrimSpace(arg), "--new-window") {
			return args
		}
	}
	return append(args, "--new-window")
}

func browserDefaultStartURLs(cfg *config.Config) []string {
	if cfg != nil && cfg.Browser.DefaultStartURLs != nil {
		return normalizeNonEmptyStrings(cfg.Browser.DefaultStartURLs)
	}
	return config.DefaultBrowserStartURLs()
}

func (a *App) browserDefaultStartURLs() []string {
	return mergeStartURLs(browserDefaultStartURLs(a.config), bookmarkStartURLs(a.BookmarkList()))
}

func bookmarkStartURLs(bookmarks []BrowserBookmark) []string {
	if len(bookmarks) == 0 {
		return nil
	}
	urls := make([]string, 0, len(bookmarks))
	for _, bookmark := range bookmarks {
		if bookmark.OpenOnStart {
			urls = append(urls, bookmark.URL)
		}
	}
	return normalizeNonEmptyStrings(urls)
}

func mergeStartURLs(groups ...[]string) []string {
	seen := map[string]struct{}{}
	out := []string{}
	for _, group := range groups {
		for _, item := range normalizeNonEmptyStrings(group) {
			key := strings.ToLower(item)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			out = append(out, item)
		}
	}
	return out
}

func browserRestoreLastSession(cfg *config.Config) bool {
	if cfg == nil {
		return false
	}
	return cfg.Browser.RestoreLastSession
}

func appendLaunchTargets(args []string, startURLs []string, defaultStartURLs []string, skipDefaultStartURLs bool, restoreLastSession bool) []string {
	normalizedStartURLs := normalizeNonEmptyStrings(startURLs)
	if len(normalizedStartURLs) > 0 {
		return browser.BuildLaunchArgs(args, normalizedStartURLs)
	}

	if !skipDefaultStartURLs {
		normalizedDefaultStartURLs := normalizeNonEmptyStrings(defaultStartURLs)
		if len(normalizedDefaultStartURLs) > 0 {
			return browser.BuildLaunchArgs(args, normalizedDefaultStartURLs)
		}
	}

	if !restoreLastSession {
		return browser.BuildLaunchArgs(args, []string{"about:blank"})
	}

	return args
}

func (a *App) markProfileStoppedLocked(profileId string, profile *BrowserProfile) {
	if profile == nil {
		return
	}
	profile.Running = false
	profile.DebugReady = false
	profile.Pid = 0
	profile.DebugPort = 0
	profile.RuntimeWarning = ""
	profile.LastStopAt = time.Now().Format(time.RFC3339)
	delete(a.browserMgr.BrowserProcesses, profileId)
	a.releaseProfileXrayBridge(profileId)
	if a.launchServer != nil {
		a.launchServer.ClearActiveProfile(profileId)
	}
}

func (a *App) openBrowserWindowForRunningProfile(profile *BrowserProfile, extraLaunchArgs []string, startURLs []string) error {
	if profile == nil {
		return fmt.Errorf("实例为空")
	}
	if profile.DebugPort <= 0 || !profile.DebugReady {
		return fmt.Errorf("实例调试接口尚未就绪")
	}
	for _, targetURL := range normalizeNonEmptyStrings(startURLs) {
		if err := cdpBrowserCall(profile.DebugPort, "Target.createTarget", map[string]any{"url": targetURL}); err != nil {
			return err
		}
	}
	return nil
}
