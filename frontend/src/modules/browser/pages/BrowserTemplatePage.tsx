import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit2, Plus, Trash2, Wand2 } from 'lucide-react'
import { Button, Card, ConfirmModal, FormItem, Input, Modal, Select, Table, Textarea, toast } from '../../../shared/components'
import type { TableColumn } from '../../../shared/components/Table'
import type { BrowserCore, BrowserGroup, BrowserProfileTemplate, BrowserProfileTemplateInput, BrowserProxy } from '../types'
import { createBrowserProfileTemplate, deleteBrowserProfileTemplate, fetchBrowserCores, fetchBrowserProfileTemplates, fetchBrowserProxies, fetchGroups, updateBrowserProfileTemplate } from '../api'
import { FingerprintPanel } from '../components/FingerprintPanel'
import { randomFingerprintArgs } from '../utils/fingerprintSerializer'

const directProxyID = '__direct__'

function emptyTemplateInput(): BrowserProfileTemplateInput {
  return {
    templateName: '',
    profileName: '',
    userDataDir: '',
    coreId: '',
    fingerprintArgs: [],
    proxyId: directProxyID,
    proxyConfig: '',
    launchArgs: [],
    tags: [],
    keywords: [],
    groupId: '',
  }
}

function splitLines(value: string): string[] {
  return value.split('\n').map(item => item.trim()).filter(Boolean)
}

function splitComma(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function toInput(template: BrowserProfileTemplate): BrowserProfileTemplateInput {
  return {
    templateName: template.templateName,
    profileName: template.profileName,
    userDataDir: template.userDataDir,
    coreId: template.coreId,
    fingerprintArgs: template.fingerprintArgs || [],
    proxyId: template.proxyId || directProxyID,
    proxyConfig: template.proxyConfig || '',
    launchArgs: template.launchArgs || [],
    tags: template.tags || [],
    keywords: template.keywords || [],
    groupId: template.groupId || '',
  }
}

export function BrowserTemplatePage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<BrowserProfileTemplate[]>([])
  const [cores, setCores] = useState<BrowserCore[]>([])
  const [proxies, setProxies] = useState<BrowserProxy[]>([])
  const [groups, setGroups] = useState<BrowserGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BrowserProfileTemplate | null>(null)
  const [formData, setFormData] = useState<BrowserProfileTemplateInput>(emptyTemplateInput())
  const [launchArgsText, setLaunchArgsText] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [keywordsText, setKeywordsText] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BrowserProfileTemplate | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [templateList, coreList, proxyList, groupList] = await Promise.all([
        fetchBrowserProfileTemplates(),
        fetchBrowserCores(),
        fetchBrowserProxies(),
        fetchGroups(),
      ])
      setTemplates(templateList)
      setCores(coreList)
      setProxies(proxyList)
      setGroups(groupList)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const defaultCore = cores.find(core => core.isDefault)
  const coreOptions = useMemo(() => [
    { value: '', label: defaultCore ? `使用默认 (${defaultCore.coreName})` : '使用默认内核' },
    ...cores.map(core => ({ value: core.coreId, label: core.coreName })),
  ], [cores, defaultCore])
  const proxyOptions = useMemo(() => proxies.length > 0
    ? proxies.map(proxy => ({ value: proxy.proxyId, label: proxy.proxyName || proxy.proxyId }))
    : [{ value: directProxyID, label: '直连（不走代理）' }], [proxies])
  const groupOptions = useMemo(() => [
    { value: '', label: '未分组' },
    ...groups.map(group => ({ value: group.groupId, label: group.groupName })),
  ], [groups])

  const openCreate = () => {
    setEditing(null)
    const next = emptyTemplateInput()
    setFormData(next)
    setLaunchArgsText('')
    setTagsText('')
    setKeywordsText('')
    setModalOpen(true)
  }

  const openEdit = (template: BrowserProfileTemplate) => {
    const next = toInput(template)
    setEditing(template)
    setFormData(next)
    setLaunchArgsText(next.launchArgs.join('\n'))
    setTagsText(next.tags.join(', '))
    setKeywordsText(next.keywords.join(', '))
    setModalOpen(true)
  }

  const handleChange = (field: keyof BrowserProfileTemplateInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFingerprintChange = (fingerprintArgs: string[]) => {
    setFormData(prev => ({ ...prev, fingerprintArgs }))
  }

  const handleRandomFingerprint = () => {
    setFormData(prev => ({ ...prev, fingerprintArgs: randomFingerprintArgs(prev.fingerprintArgs) }))
    toast.success('已生成随机指纹')
  }

  const handleSave = async () => {
    const payload: BrowserProfileTemplateInput = {
      ...formData,
      templateName: formData.templateName.trim(),
      profileName: formData.profileName.trim(),
      userDataDir: formData.userDataDir.trim(),
      proxyId: formData.proxyId || directProxyID,
      proxyConfig: '',
      fingerprintArgs: formData.fingerprintArgs || [],
      launchArgs: splitLines(launchArgsText),
      tags: splitComma(tagsText),
      keywords: splitComma(keywordsText),
    }
    if (!payload.templateName) {
      toast.error('请输入模板名称')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateBrowserProfileTemplate(editing.templateId, payload)
        toast.success('模板已更新')
      } else {
        await createBrowserProfileTemplate(payload)
        toast.success('模板已创建')
      }
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteBrowserProfileTemplate(deleteTarget.templateId)
    toast.success('模板已删除')
    setDeleteTarget(null)
    await load()
  }

  const columns: TableColumn<BrowserProfileTemplate>[] = [
    { key: 'templateName', title: '模板名称', render: value => <span className="font-medium text-[var(--color-text-primary)]">{value}</span> },
    { key: 'profileName', title: '实例名称模板', render: value => value || '-' },
    { key: 'coreId', title: '内核', render: value => cores.find(core => core.coreId === value)?.coreName || '默认内核' },
    { key: 'proxyId', title: '代理', render: value => proxies.find(proxy => proxy.proxyId === value)?.proxyName || value || '直连' },
    { key: 'tags', title: '标签', render: value => (value || []).join(', ') || '-' },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (_value, record) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEdit(record)}><Edit2 className="w-4 h-4" />编辑</Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(record)}><Trash2 className="w-4 h-4" />删除</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">实例模板</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">保存常用创建配置，创建实例时可直接套用</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/browser/list')}>返回列表</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4" />新建模板</Button>
        </div>
      </div>

      <Card title="模板列表" subtitle="模板只保存创建参数，不影响已创建实例">
        <Table columns={columns} data={templates} rowKey="templateId" loading={loading} emptyText="暂无实例模板" />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '编辑实例模板' : '新建实例模板'}
        width="760px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={handleSave} loading={saving}>保存模板</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormItem label="模板名称" required>
            <Input value={formData.templateName} onChange={event => handleChange('templateName', event.target.value)} placeholder="例如：Gmail 登录环境" />
          </FormItem>
          <FormItem label="实例名称模板">
            <Input value={formData.profileName} onChange={event => handleChange('profileName', event.target.value)} placeholder="创建时可继续修改" />
          </FormItem>
          <FormItem label="用户数据目录">
            <Input value={formData.userDataDir} onChange={event => handleChange('userDataDir', event.target.value)} placeholder="留空自动生成" />
          </FormItem>
          <FormItem label="内核">
            <Select value={formData.coreId} onChange={event => handleChange('coreId', event.target.value)} options={coreOptions} />
          </FormItem>
          <FormItem label="代理池选择">
            <Select value={formData.proxyId || directProxyID} onChange={event => handleChange('proxyId', event.target.value)} options={proxyOptions} />
          </FormItem>
          <FormItem label="分组">
            <Select value={formData.groupId || ''} onChange={event => handleChange('groupId', event.target.value)} options={groupOptions} />
          </FormItem>
          <FormItem label="标签" hint="逗号分隔">
            <Input value={tagsText} onChange={event => setTagsText(event.target.value)} placeholder="默认, 海外" />
          </FormItem>
          <FormItem label="关键字" hint="逗号分隔">
            <Input value={keywordsText} onChange={event => setKeywordsText(event.target.value)} placeholder="账号, 业务" />
          </FormItem>
          <div className="md:col-span-2 rounded-lg border border-[var(--color-border-default)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-muted)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">指纹配置</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">保存到模板后，单个创建和批量创建选择模板都会带出</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleRandomFingerprint}><Wand2 className="w-4 h-4" />一键随机指纹</Button>
            </div>
            <div className="p-4">
              <FingerprintPanel value={formData.fingerprintArgs} onChange={handleFingerprintChange} />
            </div>
          </div>
          <FormItem label="启动参数" className="md:col-span-2" hint="每行一个参数">
            <Textarea value={launchArgsText} onChange={event => setLaunchArgsText(event.target.value)} rows={5} placeholder="--disable-sync" />
          </FormItem>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除实例模板？"
        content={`确定删除模板「${deleteTarget?.templateName || ''}」吗？已创建的实例不会受影响。`}
        confirmText="删除"
        cancelText="取消"
        danger
      />
    </div>
  )
}
