import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Wand2 } from 'lucide-react'
import { Button, Card, FormItem, Input, Modal, Select, Textarea, toast } from '../../../shared/components'
import type { BrowserCore, BrowserGroup, BrowserProfileBatchCreateResult, BrowserProfileInput, BrowserProfileTemplate, BrowserProxy, BrowserSettings } from '../types'
import { batchCreateBrowserProfiles, fetchBrowserCores, fetchBrowserProfileTemplates, fetchBrowserProxies, fetchBrowserSettings, fetchGroups } from '../api'
import { TagInput } from '../components/TagInput'
import { GroupSelector } from '../components/GroupSelector'
import { ProxyPickerModal } from '../components/ProxyPickerModal'
import { FingerprintPanel } from '../components/FingerprintPanel'
import { randomFingerprintArgs } from '../utils/fingerprintSerializer'

const directProxyID = '__direct__'
const fallbackLowLaunchArgs = ['--disable-sync', '--no-first-run']

function normalizeLaunchArgs(args: string[]): string[] {
  return (args || []).map(item => item.trim()).filter(Boolean)
}

function resolveDefaultLaunchArgs(settings: BrowserSettings): string[] {
  const normalized = normalizeLaunchArgs(settings.defaultLaunchArgs || [])
  return normalized.length > 0 ? normalized : fallbackLowLaunchArgs
}

function emptyInput(): BrowserProfileInput {
  return {
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

function inputFromTemplate(template: BrowserProfileTemplate): BrowserProfileInput {
  return {
    profileName: template.profileName || template.templateName,
    userDataDir: template.userDataDir || '',
    coreId: template.coreId || '',
    fingerprintArgs: template.fingerprintArgs || [],
    proxyId: template.proxyId || directProxyID,
    proxyConfig: template.proxyConfig || '',
    launchArgs: template.launchArgs || [],
    tags: template.tags || [],
    keywords: template.keywords || [],
    groupId: template.groupId || '',
  }
}

export function BrowserBatchCreatePage() {
  const navigate = useNavigate()
  const [count, setCount] = useState(2)
  const [formData, setFormData] = useState<BrowserProfileInput>(emptyInput())
  const [launchArgsText, setLaunchArgsText] = useState('')
  const [templates, setTemplates] = useState<BrowserProfileTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [cores, setCores] = useState<BrowserCore[]>([])
  const [proxies, setProxies] = useState<BrowserProxy[]>([])
  const [groups, setGroups] = useState<BrowserGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [proxyPickerOpen, setProxyPickerOpen] = useState(false)
  const [result, setResult] = useState<BrowserProfileBatchCreateResult | null>(null)
  const [randomizeFingerprintPerProfile, setRandomizeFingerprintPerProfile] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [templateList, coreList, proxyList, groupList, settings] = await Promise.all([
        fetchBrowserProfileTemplates(),
        fetchBrowserCores(),
        fetchBrowserProxies(),
        fetchGroups(),
        fetchBrowserSettings(),
      ])
      setTemplates(templateList)
      setCores(coreList)
      setProxies(proxyList)
      setGroups(groupList)
      setFormData(prev => ({ ...prev, proxyId: proxyList.find(proxy => proxy.proxyId === directProxyID)?.proxyId || directProxyID }))
      setLaunchArgsText(resolveDefaultLaunchArgs(settings).join('\n'))
    }
    load()
  }, [])

  const defaultCore = cores.find(core => core.isDefault)
  const templateOptions = useMemo(() => [
    { value: '', label: '不使用模板' },
    ...templates.map(template => ({ value: template.templateId, label: template.templateName })),
  ], [templates])
  const coreOptions = useMemo(() => [
    { value: '', label: defaultCore ? `使用默认 (${defaultCore.coreName})` : '使用默认内核' },
    ...cores.map(core => ({ value: core.coreId, label: core.coreName })),
  ], [cores, defaultCore])
  const proxyOptions = useMemo(() => proxies.length > 0
    ? proxies.map(proxy => ({ value: proxy.proxyId, label: proxy.proxyName || proxy.proxyId }))
    : [{ value: directProxyID, label: '直连（不走代理）' }], [proxies])

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templates.find(item => item.templateId === templateId)
    if (!template) return
    const next = inputFromTemplate(template)
    setFormData(next)
    setLaunchArgsText(normalizeLaunchArgs(next.launchArgs).join('\n'))
    setRandomizeFingerprintPerProfile(false)
  }

  const handleChange = (field: keyof BrowserProfileInput, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'fingerprintArgs') {
      setRandomizeFingerprintPerProfile(false)
    }
  }

  const handleRandomFingerprint = () => {
    setFormData(prev => ({ ...prev, fingerprintArgs: randomFingerprintArgs(prev.fingerprintArgs) }))
    setRandomizeFingerprintPerProfile(true)
    toast.success('已生成随机指纹；批量创建时每个实例会独立随机种子')
  }

  const handleProxyListUpdated = (nextProxies: BrowserProxy[]) => {
    setProxies(nextProxies)
  }

  const handleProxyDeleted = (deletedProxyId: string, nextProxies: BrowserProxy[]) => {
    setProxies(nextProxies)
    if (formData.proxyId === deletedProxyId) {
      handleChange('proxyId', nextProxies.find(proxy => proxy.proxyId === directProxyID)?.proxyId || '')
    }
  }

  const handleBatchCreate = async () => {
    const safeCount = Math.max(1, Math.min(200, Number(count) || 1))
    const payload: BrowserProfileInput = {
      ...formData,
      profileName: formData.profileName.trim() || '新建实例',
      userDataDir: formData.userDataDir.trim(),
      proxyId: formData.proxyId || directProxyID,
      proxyConfig: '',
      launchArgs: normalizeLaunchArgs(launchArgsText.split('\n')),
      keywords: formData.keywords || [],
      tags: formData.tags || [],
    }
    setSaving(true)
    try {
      const nextResult = await batchCreateBrowserProfiles({
        count: safeCount,
        base: payload,
        randomizeFingerprintPerProfile,
      })
      setResult(nextResult)
      if (nextResult.failed > 0) {
        toast.warning(`批量创建完成：成功 ${nextResult.succeeded} 个，失败 ${nextResult.failed} 个`)
      } else {
        toast.success(`已成功创建 ${nextResult.succeeded} 个实例`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">批量创建实例</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">基于同一组配置一次创建多个实例，名称和目录会自动追加序号</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/browser/list')}>返回列表</Button>
          <Button size="sm" onClick={handleBatchCreate} loading={saving}>开始创建</Button>
        </div>
      </div>

      <Card title="批量设置" subtitle="选择模板后仍可在创建前继续修改所有配置">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormItem label="创建数量" required hint="1-200">
            <Input type="number" min={1} max={200} value={count} onChange={event => setCount(Number(event.target.value))} />
          </FormItem>
          <FormItem label="实例模板">
            <Select value={selectedTemplateId} onChange={event => handleTemplateChange(event.target.value)} options={templateOptions} />
          </FormItem>
          <FormItem label="实例名称前缀" required>
            <Input value={formData.profileName} onChange={event => handleChange('profileName', event.target.value)} placeholder="例如：账号环境" />
          </FormItem>
          <FormItem label="用户数据目录前缀">
            <Input value={formData.userDataDir} onChange={event => handleChange('userDataDir', event.target.value)} placeholder="留空自动生成" />
          </FormItem>
          <FormItem label="内核">
            <Select value={formData.coreId} onChange={event => handleChange('coreId', event.target.value)} options={coreOptions} />
          </FormItem>
          <FormItem label="分组">
            <GroupSelector groups={groups} value={formData.groupId || ''} onChange={groupId => handleChange('groupId', groupId)} placeholder="未分组" className="w-full" />
          </FormItem>
          <FormItem label="标签" className="md:col-span-2">
            <TagInput value={formData.tags} onChange={tags => handleChange('tags', tags)} placeholder="输入标签后按回车" />
          </FormItem>
        </div>
      </Card>

      <Card title="代理配置" subtitle="批量创建使用同一个代理池节点或直连节点">
        <FormItem label="代理池选择">
          <div className="flex gap-2">
            <Select value={formData.proxyId} onChange={event => handleChange('proxyId', event.target.value)} options={proxyOptions} className="flex-1" />
            <Button variant="secondary" size="sm" onClick={() => setProxyPickerOpen(true)} title="按分组选择代理">
              <Layers className="w-4 h-4" />
            </Button>
          </div>
        </FormItem>
      </Card>

      <ProxyPickerModal
        open={proxyPickerOpen}
        currentProxyId={formData.proxyId}
        onSelect={proxy => handleChange('proxyId', proxy.proxyId)}
        onProxyListUpdated={handleProxyListUpdated}
        onProxyDeleted={handleProxyDeleted}
        onClose={() => setProxyPickerOpen(false)}
      />

      <Card
        title="指纹配置"
        subtitle={randomizeFingerprintPerProfile ? '已启用批量独立随机：每个实例会保存不同的 --fingerprint seed' : '模板中的指纹参数可在这里覆盖'}
        actions={<Button variant="secondary" size="sm" onClick={handleRandomFingerprint}><Wand2 className="w-4 h-4" />一键随机指纹</Button>}
      >
        <FingerprintPanel
          value={formData.fingerprintArgs}
          onChange={args => handleChange('fingerprintArgs', args)}
        />
      </Card>

      <Card title="启动参数" subtitle="模板中的启动参数可在这里覆盖">
        <div className="space-y-4">
          <FormItem label="启动参数" hint="每行一个参数">
            <Textarea value={launchArgsText} onChange={event => setLaunchArgsText(event.target.value)} rows={5} placeholder="--disable-sync" />
          </FormItem>
        </div>
      </Card>

      <Modal
        open={!!result}
        onClose={() => setResult(null)}
        title="批量创建结果"
        width="720px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResult(null)}>留在当前页</Button>
            <Button onClick={() => navigate('/browser/list')}>查看实例列表</Button>
          </>
        }
      >
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-[var(--color-bg-secondary)] p-3"><div className="text-lg font-semibold">{result.total}</div><div className="text-xs text-[var(--color-text-muted)]">总数</div></div>
              <div className="rounded-lg bg-green-50 p-3"><div className="text-lg font-semibold text-green-600">{result.succeeded}</div><div className="text-xs text-green-600">成功</div></div>
              <div className="rounded-lg bg-red-50 p-3"><div className="text-lg font-semibold text-red-600">{result.failed}</div><div className="text-xs text-red-600">失败</div></div>
            </div>
            {result.failed > 0 && (
              <div className="max-h-72 overflow-auto rounded-lg border border-[var(--color-border-default)]">
                {result.items.filter(item => item.error).map(item => (
                  <div key={item.index} className="border-b border-[var(--color-border-muted)] last:border-b-0 p-3 text-sm">
                    <div className="font-medium text-[var(--color-text-primary)]">#{item.index} {item.profileName}</div>
                    <div className="text-red-500 mt-1 whitespace-pre-line">{item.error}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
