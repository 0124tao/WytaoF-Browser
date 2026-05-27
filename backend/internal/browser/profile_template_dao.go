package browser

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type ProfileTemplateDAO interface {
	List() ([]*ProfileTemplate, error)
	GetById(templateId string) (*ProfileTemplate, error)
	Create(input ProfileTemplateInput) (*ProfileTemplate, error)
	Update(templateId string, input ProfileTemplateInput) (*ProfileTemplate, error)
	Delete(templateId string) error
}

type SQLiteProfileTemplateDAO struct {
	db *sql.DB
}

func NewSQLiteProfileTemplateDAO(db *sql.DB) *SQLiteProfileTemplateDAO {
	return &SQLiteProfileTemplateDAO{db: db}
}

func (d *SQLiteProfileTemplateDAO) List() ([]*ProfileTemplate, error) {
	rows, err := d.db.Query(`
		SELECT template_id, template_name, profile_name, user_data_dir, core_id,
		       fingerprint_args, proxy_id, proxy_config, launch_args, tags, keywords, group_id,
		       created_at, updated_at
		FROM browser_profile_templates ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("查询实例模板列表失败: %w", err)
	}
	defer rows.Close()

	var list []*ProfileTemplate
	for rows.Next() {
		tpl, err := scanProfileTemplate(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, tpl)
	}
	return list, rows.Err()
}

func (d *SQLiteProfileTemplateDAO) GetById(templateId string) (*ProfileTemplate, error) {
	row := d.db.QueryRow(`
		SELECT template_id, template_name, profile_name, user_data_dir, core_id,
		       fingerprint_args, proxy_id, proxy_config, launch_args, tags, keywords, group_id,
		       created_at, updated_at
		FROM browser_profile_templates WHERE template_id = ?`, templateId)
	tpl, err := scanProfileTemplate(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("实例模板不存在: %s", templateId)
	}
	return tpl, err
}

func (d *SQLiteProfileTemplateDAO) Create(input ProfileTemplateInput) (*ProfileTemplate, error) {
	now := time.Now().Format(time.RFC3339)
	tpl := &ProfileTemplate{
		TemplateId:      uuid.NewString(),
		TemplateName:    input.TemplateName,
		ProfileName:     input.ProfileName,
		UserDataDir:     input.UserDataDir,
		CoreId:          normalizeProfileCoreID(input.CoreId),
		FingerprintArgs: append([]string{}, input.FingerprintArgs...),
		ProxyId:         input.ProxyId,
		ProxyConfig:     input.ProxyConfig,
		LaunchArgs:      append([]string{}, input.LaunchArgs...),
		Tags:            append([]string{}, input.Tags...),
		Keywords:        append([]string{}, input.Keywords...),
		GroupId:         buildProfileGroupID(input.GroupId),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := d.upsert(tpl); err != nil {
		return nil, err
	}
	return tpl, nil
}

func (d *SQLiteProfileTemplateDAO) Update(templateId string, input ProfileTemplateInput) (*ProfileTemplate, error) {
	existing, err := d.GetById(templateId)
	if err != nil {
		return nil, err
	}
	existing.TemplateName = input.TemplateName
	existing.ProfileName = input.ProfileName
	existing.UserDataDir = input.UserDataDir
	existing.CoreId = normalizeProfileCoreID(input.CoreId)
	existing.FingerprintArgs = append([]string{}, input.FingerprintArgs...)
	existing.ProxyId = input.ProxyId
	existing.ProxyConfig = input.ProxyConfig
	existing.LaunchArgs = append([]string{}, input.LaunchArgs...)
	existing.Tags = append([]string{}, input.Tags...)
	existing.Keywords = append([]string{}, input.Keywords...)
	existing.GroupId = buildProfileGroupID(input.GroupId)
	existing.UpdatedAt = time.Now().Format(time.RFC3339)
	if err := d.upsert(existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (d *SQLiteProfileTemplateDAO) Delete(templateId string) error {
	_, err := d.db.Exec(`DELETE FROM browser_profile_templates WHERE template_id = ?`, templateId)
	if err != nil {
		return fmt.Errorf("删除实例模板失败: %w", err)
	}
	return nil
}

func (d *SQLiteProfileTemplateDAO) upsert(tpl *ProfileTemplate) error {
	fingerprintArgs, _ := json.Marshal(tpl.FingerprintArgs)
	launchArgs, _ := json.Marshal(tpl.LaunchArgs)
	tags, _ := json.Marshal(tpl.Tags)
	keywords, _ := json.Marshal(tpl.Keywords)

	_, err := d.db.Exec(`
		INSERT INTO browser_profile_templates
		  (template_id, template_name, profile_name, user_data_dir, core_id, fingerprint_args,
		   proxy_id, proxy_config, launch_args, tags, keywords, group_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(template_id) DO UPDATE SET
		  template_name    = excluded.template_name,
		  profile_name     = excluded.profile_name,
		  user_data_dir    = excluded.user_data_dir,
		  core_id          = excluded.core_id,
		  fingerprint_args = excluded.fingerprint_args,
		  proxy_id         = excluded.proxy_id,
		  proxy_config     = excluded.proxy_config,
		  launch_args      = excluded.launch_args,
		  tags             = excluded.tags,
		  keywords         = excluded.keywords,
		  group_id         = excluded.group_id,
		  updated_at       = excluded.updated_at`,
		tpl.TemplateId, tpl.TemplateName, tpl.ProfileName, tpl.UserDataDir, tpl.CoreId,
		string(fingerprintArgs), tpl.ProxyId, tpl.ProxyConfig, string(launchArgs), string(tags),
		string(keywords), tpl.GroupId, tpl.CreatedAt, tpl.UpdatedAt)
	if err != nil {
		return fmt.Errorf("保存实例模板失败: %w", err)
	}
	return nil
}

func scanProfileTemplate(s scanner) (*ProfileTemplate, error) {
	var (
		fingerprintArgsJSON, launchArgsJSON, tagsJSON, keywordsJSON string
		tpl                                                         ProfileTemplate
	)
	err := s.Scan(
		&tpl.TemplateId, &tpl.TemplateName, &tpl.ProfileName, &tpl.UserDataDir, &tpl.CoreId,
		&fingerprintArgsJSON, &tpl.ProxyId, &tpl.ProxyConfig, &launchArgsJSON, &tagsJSON,
		&keywordsJSON, &tpl.GroupId, &tpl.CreatedAt, &tpl.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal([]byte(fingerprintArgsJSON), &tpl.FingerprintArgs)
	_ = json.Unmarshal([]byte(launchArgsJSON), &tpl.LaunchArgs)
	_ = json.Unmarshal([]byte(tagsJSON), &tpl.Tags)
	_ = json.Unmarshal([]byte(keywordsJSON), &tpl.Keywords)
	if tpl.FingerprintArgs == nil {
		tpl.FingerprintArgs = []string{}
	}
	if tpl.LaunchArgs == nil {
		tpl.LaunchArgs = []string{}
	}
	if tpl.Tags == nil {
		tpl.Tags = []string{}
	}
	if tpl.Keywords == nil {
		tpl.Keywords = []string{}
	}
	return &tpl, nil
}
