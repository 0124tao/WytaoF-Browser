package browser

import (
	"ant-chrome/backend/internal/config"
	"strings"
	"testing"
)

func TestBatchCreateRandomizesFingerprintSeedPerProfile(t *testing.T) {
	manager := NewManager(config.DefaultConfig(), t.TempDir())
	manager.ProxyDAO = &proxyDAOStub{
		list: []Proxy{
			{ProxyId: directProxyID, ProxyName: "直连（不走代理）", ProxyConfig: "direct://"},
		},
	}
	result := manager.BatchCreate(ProfileBatchCreateInput{
		Count: 5,
		Base: ProfileInput{
			ProfileName:     "批量实例",
			FingerprintArgs: []string{"--fingerprint=123", "--lang=zh-CN"},
			ProxyId:         "__direct__",
		},
		RandomizeFingerprintPerProfile: true,
	})
	if result.Failed != 0 || result.Succeeded != 5 {
		t.Fatalf("批量创建结果异常: succeeded=%d failed=%d", result.Succeeded, result.Failed)
	}
	seeds := map[string]bool{}
	for _, item := range result.Items {
		if item.Profile == nil {
			t.Fatalf("实例 #%d 未返回 profile", item.Index)
		}
		var seed string
		for _, arg := range item.Profile.FingerprintArgs {
			if strings.HasPrefix(arg, "--fingerprint=") {
				seed = strings.TrimPrefix(arg, "--fingerprint=")
				break
			}
		}
		if seed == "" {
			t.Fatalf("实例 #%d 未保存 fingerprint seed: %v", item.Index, item.Profile.FingerprintArgs)
		}
		if seeds[seed] {
			t.Fatalf("实例 #%d 复用了 fingerprint seed: %s", item.Index, seed)
		}
		seeds[seed] = true
	}
}
