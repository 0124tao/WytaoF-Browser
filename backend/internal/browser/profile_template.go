package browser

import (
	"ant-chrome/backend/internal/config"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (m *Manager) ListProfileTemplates() ([]ProfileTemplate, error) {
	if m.TemplateDAO != nil {
		items, err := m.TemplateDAO.List()
		if err != nil {
			return nil, err
		}
		result := make([]ProfileTemplate, 0, len(items))
		for _, item := range items {
			if item != nil {
				result = append(result, *item)
			}
		}
		return result, nil
	}

	result := make([]ProfileTemplate, 0, len(m.Config.Browser.ProfileTemplates))
	for _, item := range m.Config.Browser.ProfileTemplates {
		result = append(result, profileTemplateFromConfig(item))
	}
	return result, nil
}

func (m *Manager) CreateProfileTemplate(input ProfileTemplateInput) (*ProfileTemplate, error) {
	input.TemplateName = strings.TrimSpace(input.TemplateName)
	if input.TemplateName == "" {
		return nil, fmt.Errorf("模板名称不能为空")
	}
	if m.TemplateDAO != nil {
		return m.TemplateDAO.Create(input)
	}

	now := time.Now().Format(time.RFC3339)
	tpl := ProfileTemplate{
		TemplateId:      uuid.NewString(),
		TemplateName:    input.TemplateName,
		ProfileName:     strings.TrimSpace(input.ProfileName),
		UserDataDir:     strings.TrimSpace(input.UserDataDir),
		CoreId:          normalizeProfileCoreID(input.CoreId),
		FingerprintArgs: append([]string{}, input.FingerprintArgs...),
		ProxyId:         strings.TrimSpace(input.ProxyId),
		ProxyConfig:     strings.TrimSpace(input.ProxyConfig),
		LaunchArgs:      append([]string{}, input.LaunchArgs...),
		Tags:            append([]string{}, input.Tags...),
		Keywords:        append([]string{}, input.Keywords...),
		GroupId:         buildProfileGroupID(input.GroupId),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	m.Config.Browser.ProfileTemplates = append(m.Config.Browser.ProfileTemplates, profileTemplateToConfig(tpl))
	if err := m.Config.Save(m.ResolveRelativePath("config.yaml")); err != nil {
		return nil, err
	}
	return &tpl, nil
}

func (m *Manager) UpdateProfileTemplate(templateId string, input ProfileTemplateInput) (*ProfileTemplate, error) {
	templateId = strings.TrimSpace(templateId)
	input.TemplateName = strings.TrimSpace(input.TemplateName)
	if templateId == "" {
		return nil, fmt.Errorf("模板ID不能为空")
	}
	if input.TemplateName == "" {
		return nil, fmt.Errorf("模板名称不能为空")
	}
	if m.TemplateDAO != nil {
		return m.TemplateDAO.Update(templateId, input)
	}

	for i, item := range m.Config.Browser.ProfileTemplates {
		if item.TemplateId != templateId {
			continue
		}
		tpl := profileTemplateFromConfig(item)
		tpl.TemplateName = input.TemplateName
		tpl.ProfileName = strings.TrimSpace(input.ProfileName)
		tpl.UserDataDir = strings.TrimSpace(input.UserDataDir)
		tpl.CoreId = normalizeProfileCoreID(input.CoreId)
		tpl.FingerprintArgs = append([]string{}, input.FingerprintArgs...)
		tpl.ProxyId = strings.TrimSpace(input.ProxyId)
		tpl.ProxyConfig = strings.TrimSpace(input.ProxyConfig)
		tpl.LaunchArgs = append([]string{}, input.LaunchArgs...)
		tpl.Tags = append([]string{}, input.Tags...)
		tpl.Keywords = append([]string{}, input.Keywords...)
		tpl.GroupId = buildProfileGroupID(input.GroupId)
		tpl.UpdatedAt = time.Now().Format(time.RFC3339)
		m.Config.Browser.ProfileTemplates[i] = profileTemplateToConfig(tpl)
		if err := m.Config.Save(m.ResolveRelativePath("config.yaml")); err != nil {
			return nil, err
		}
		return &tpl, nil
	}
	return nil, fmt.Errorf("实例模板不存在: %s", templateId)
}

func (m *Manager) DeleteProfileTemplate(templateId string) error {
	templateId = strings.TrimSpace(templateId)
	if templateId == "" {
		return fmt.Errorf("模板ID不能为空")
	}
	if m.TemplateDAO != nil {
		return m.TemplateDAO.Delete(templateId)
	}

	next := m.Config.Browser.ProfileTemplates[:0]
	deleted := false
	for _, item := range m.Config.Browser.ProfileTemplates {
		if item.TemplateId == templateId {
			deleted = true
			continue
		}
		next = append(next, item)
	}
	if !deleted {
		return fmt.Errorf("实例模板不存在: %s", templateId)
	}
	m.Config.Browser.ProfileTemplates = next
	return m.Config.Save(m.ResolveRelativePath("config.yaml"))
}

func (m *Manager) BatchCreate(input ProfileBatchCreateInput) ProfileBatchCreateResult {
	count := input.Count
	if count < 1 {
		count = 1
	}
	if count > 200 {
		count = 200
	}
	result := ProfileBatchCreateResult{
		Total: count,
		Items: make([]ProfileBatchCreateItemResult, 0, count),
	}
	baseName := strings.TrimSpace(input.Base.ProfileName)
	if baseName == "" {
		baseName = "新建实例"
	}
	for i := 1; i <= count; i++ {
		payload := input.Base
		payload.ProfileName = buildBatchProfileName(baseName, i, count)
		if strings.TrimSpace(payload.UserDataDir) != "" && count > 1 {
			payload.UserDataDir = fmt.Sprintf("%s-%03d", strings.TrimSpace(payload.UserDataDir), i)
		}
		if input.RandomizeFingerprintPerProfile {
			payload.FingerprintArgs = withRandomFingerprintSeed(payload.FingerprintArgs)
		}
		profile, err := m.Create(payload)
		item := ProfileBatchCreateItemResult{Index: i, ProfileName: payload.ProfileName}
		if err != nil {
			item.Error = err.Error()
			result.Failed++
		} else {
			item.Profile = profile
			result.Succeeded++
		}
		result.Items = append(result.Items, item)
	}
	return result
}

func buildBatchProfileName(baseName string, index int, count int) string {
	if count <= 1 {
		return baseName
	}
	return fmt.Sprintf("%s-%03d", baseName, index)
}

func withRandomFingerprintSeed(args []string) []string {
	seedArg := "--fingerprint=" + randomFingerprintSeed()
	next := make([]string, 0, len(args)+1)
	replaced := false
	for _, arg := range args {
		if strings.HasPrefix(strings.TrimSpace(arg), "--fingerprint=") {
			next = append(next, seedArg)
			replaced = true
			continue
		}
		next = append(next, arg)
	}
	if !replaced {
		next = append([]string{seedArg}, next...)
	}
	return next
}

func randomFingerprintSeed() string {
	var buf [4]byte
	if _, err := rand.Read(buf[:]); err == nil {
		value := binary.BigEndian.Uint32(buf[:])%2147483647 + 1
		return fmt.Sprintf("%d", value)
	}
	return fmt.Sprintf("%d", time.Now().UnixNano()%2147483647+1)
}

func profileTemplateFromConfig(item config.BrowserProfileTemplateConfig) ProfileTemplate {
	return ProfileTemplate{
		TemplateId:      item.TemplateId,
		TemplateName:    item.TemplateName,
		ProfileName:     item.ProfileName,
		UserDataDir:     item.UserDataDir,
		CoreId:          normalizeProfileCoreID(item.CoreId),
		FingerprintArgs: append([]string{}, item.FingerprintArgs...),
		ProxyId:         item.ProxyId,
		ProxyConfig:     item.ProxyConfig,
		LaunchArgs:      append([]string{}, item.LaunchArgs...),
		Tags:            append([]string{}, item.Tags...),
		Keywords:        append([]string{}, item.Keywords...),
		GroupId:         item.GroupId,
		CreatedAt:       item.CreatedAt,
		UpdatedAt:       item.UpdatedAt,
	}
}

func profileTemplateToConfig(item ProfileTemplate) config.BrowserProfileTemplateConfig {
	return config.BrowserProfileTemplateConfig{
		TemplateId:      item.TemplateId,
		TemplateName:    item.TemplateName,
		ProfileName:     item.ProfileName,
		UserDataDir:     item.UserDataDir,
		CoreId:          normalizeProfileCoreID(item.CoreId),
		FingerprintArgs: append([]string{}, item.FingerprintArgs...),
		ProxyId:         item.ProxyId,
		ProxyConfig:     item.ProxyConfig,
		LaunchArgs:      append([]string{}, item.LaunchArgs...),
		Tags:            append([]string{}, item.Tags...),
		Keywords:        append([]string{}, item.Keywords...),
		GroupId:         item.GroupId,
		CreatedAt:       item.CreatedAt,
		UpdatedAt:       item.UpdatedAt,
	}
}
