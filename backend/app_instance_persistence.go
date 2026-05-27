package backend

import (
	"os"
	"path/filepath"
	"time"
)

type profileStorageSnapshot struct {
	Exists bool
	Count  int
	Size   int64
	Newest int64
}

func waitProfileStorageStable(userDataDir string, timeout time.Duration) bool {
	if userDataDir == "" || timeout <= 0 {
		return true
	}
	deadline := time.Now().Add(timeout)
	previous := snapshotProfileStorage(userDataDir)
	stableSamples := 0
	for time.Now().Before(deadline) {
		time.Sleep(300 * time.Millisecond)
		current := snapshotProfileStorage(userDataDir)
		if profileStorageSnapshotsEqual(previous, current) {
			stableSamples++
			if stableSamples >= 3 {
				return true
			}
		} else {
			stableSamples = 0
			previous = current
		}
	}
	return false
}

func snapshotProfileStorage(userDataDir string) []profileStorageSnapshot {
	paths := []string{
		filepath.Join(userDataDir, "Default", "Network", "Cookies"),
		filepath.Join(userDataDir, "Default", "Cookies"),
		filepath.Join(userDataDir, "Default", "Login Data"),
		filepath.Join(userDataDir, "Default", "Preferences"),
		filepath.Join(userDataDir, "Default", "Secure Preferences"),
		filepath.Join(userDataDir, "Default", "Local Storage"),
		filepath.Join(userDataDir, "Default", "Session Storage"),
		filepath.Join(userDataDir, "Default", "IndexedDB"),
	}
	out := make([]profileStorageSnapshot, 0, len(paths))
	for _, path := range paths {
		out = append(out, snapshotStoragePath(path))
	}
	return out
}

func snapshotStoragePath(path string) profileStorageSnapshot {
	info, err := os.Stat(path)
	if err != nil {
		return profileStorageSnapshot{}
	}
	if !info.IsDir() {
		return profileStorageSnapshot{Exists: true, Count: 1, Size: info.Size(), Newest: info.ModTime().UnixNano()}
	}
	snapshot := profileStorageSnapshot{Exists: true}
	_ = filepath.WalkDir(path, func(_ string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil || entry.IsDir() {
			return nil
		}
		fileInfo, statErr := entry.Info()
		if statErr != nil {
			return nil
		}
		snapshot.Count++
		snapshot.Size += fileInfo.Size()
		modTime := fileInfo.ModTime().UnixNano()
		if modTime > snapshot.Newest {
			snapshot.Newest = modTime
		}
		if snapshot.Count >= 5000 {
			return filepath.SkipAll
		}
		return nil
	})
	return snapshot
}

func profileStorageSnapshotsEqual(left []profileStorageSnapshot, right []profileStorageSnapshot) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}
