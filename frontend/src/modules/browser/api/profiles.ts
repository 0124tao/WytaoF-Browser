import type {
  BrowserProfile,
  BrowserProfileBatchCreateInput,
  BrowserProfileBatchCreateResult,
  BrowserProfileInput,
  BrowserProfileTemplate,
  BrowserProfileTemplateInput,
} from '../types'
import { getBindings, getMockProfiles, nowISOString, setMockProfiles } from './runtime'
import { randomFingerprintSeed } from '../utils/fingerprintSerializer'

function withRandomFingerprintSeed(args: string[] = []): string[] {
  const seedArg = `--fingerprint=${randomFingerprintSeed()}`
  let replaced = false
  const next = args.map((arg) => {
    if (arg.trim().startsWith('--fingerprint=')) {
      replaced = true
      return seedArg
    }
    return arg
  })
  return replaced ? next : [seedArg, ...next]
}

export async function fetchBrowserProfiles(): Promise<BrowserProfile[]> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileList) {
    return (await bindings.BrowserProfileList()) || []
  }
  return getMockProfiles()
}

export async function fetchBrowserProfilesByTag(tag: string): Promise<BrowserProfile[]> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileListByTag) {
    return (await bindings.BrowserProfileListByTag(tag)) || []
  }
  return getMockProfiles().filter((profile) => profile.tags?.includes(tag))
}

export async function fetchAllTags(): Promise<string[]> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserGetAllTags) {
    return (await bindings.BrowserGetAllTags()) || []
  }

  const tags = new Set<string>()
  getMockProfiles().forEach((profile) => profile.tags?.forEach((tag) => tags.add(tag)))
  return Array.from(tags).sort()
}

export async function createBrowserProfile(input: BrowserProfileInput): Promise<BrowserProfile | null> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileCreate) {
    return (await bindings.BrowserProfileCreate(input)) || null
  }

  const profile: BrowserProfile = {
    profileId: `mock-${Date.now()}`,
    ...input,
    keywords: input.keywords || [],
    running: false,
    debugPort: 0,
    debugReady: false,
    pid: 0,
    runtimeWarning: '',
    lastError: '',
    createdAt: nowISOString(),
    updatedAt: nowISOString(),
  }
  setMockProfiles([profile, ...getMockProfiles()])
  return profile
}

export async function batchCreateBrowserProfiles(input: BrowserProfileBatchCreateInput): Promise<BrowserProfileBatchCreateResult> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileBatchCreate) {
    return await bindings.BrowserProfileBatchCreate(input)
  }

  const count = Math.max(1, Math.min(200, input.count || 1))
  const items: BrowserProfileBatchCreateResult['items'] = []
  for (let index = 1; index <= count; index += 1) {
    const suffix = String(index).padStart(3, '0')
    const profileName = count > 1 ? `${input.base.profileName || '新建实例'}-${suffix}` : input.base.profileName
    const profile: BrowserProfile = {
      profileId: `mock-${Date.now()}-${index}`,
      ...input.base,
      profileName,
      userDataDir: input.base.userDataDir && count > 1 ? `${input.base.userDataDir}-${suffix}` : input.base.userDataDir,
      fingerprintArgs: input.randomizeFingerprintPerProfile ? withRandomFingerprintSeed(input.base.fingerprintArgs) : input.base.fingerprintArgs,
      keywords: input.base.keywords || [],
      running: false,
      debugPort: 0,
      debugReady: false,
      pid: 0,
      runtimeWarning: '',
      lastError: '',
      createdAt: nowISOString(),
      updatedAt: nowISOString(),
    }
    items.push({ index, profileName, profile })
  }
  setMockProfiles([...items.map(item => item.profile!).filter(Boolean), ...getMockProfiles()])
  return { total: count, succeeded: items.length, failed: 0, items }
}

export async function updateBrowserProfile(profileId: string, input: BrowserProfileInput): Promise<BrowserProfile | null> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileUpdate) {
    return (await bindings.BrowserProfileUpdate(profileId, input)) || null
  }

  const profiles = getMockProfiles()
  const index = profiles.findIndex((item) => item.profileId === profileId)
  if (index === -1) {
    return null
  }

  const nextProfiles = [...profiles]
  nextProfiles[index] = { ...nextProfiles[index], ...input, updatedAt: nowISOString() }
  setMockProfiles(nextProfiles)
  return nextProfiles[index]
}

export async function deleteBrowserProfile(profileId: string): Promise<boolean> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileDelete) {
    await bindings.BrowserProfileDelete(profileId)
    return true
  }

  setMockProfiles(getMockProfiles().filter((item) => item.profileId !== profileId))
  return true
}

export async function copyBrowserProfile(profileId: string, newName: string): Promise<BrowserProfile | null> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileCopy) {
    return (await bindings.BrowserProfileCopy(profileId, newName)) || null
  }

  const source = getMockProfiles().find((profile) => profile.profileId === profileId)
  if (!source) {
    return null
  }

  const timestamp = Date.now()
  const launchCode = `MOCK_${timestamp.toString(36).toUpperCase().slice(-6).padStart(6, '0')}`
  const copy: BrowserProfile = {
    ...source,
    profileId: `mock-${timestamp}`,
    profileName: newName || `${source.profileName} (副本)`,
    userDataDir: `mock-${timestamp}`,
    launchCode,
    running: false,
    debugReady: false,
    runtimeWarning: '',
    createdAt: nowISOString(),
    updatedAt: nowISOString(),
  }
  setMockProfiles([copy, ...getMockProfiles()])
  return copy
}

export async function setProfileKeywords(profileId: string, keywords: string[]): Promise<BrowserProfile | null> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileSetKeywords) {
    return (await bindings.BrowserProfileSetKeywords(profileId, keywords)) || null
  }

  const nextProfiles = getMockProfiles().map((profile) =>
    profile.profileId === profileId ? { ...profile, keywords, updatedAt: nowISOString() } : profile,
  )
  setMockProfiles(nextProfiles)
  return nextProfiles.find((profile) => profile.profileId === profileId) || null
}

export async function getBrowserProfileCode(profileId: string): Promise<string> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileGetCode) {
    return (await bindings.BrowserProfileGetCode(profileId)) || ''
  }
  return ''
}

export async function regenerateBrowserProfileCode(profileId: string): Promise<string> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileRegenerateCode) {
    return (await bindings.BrowserProfileRegenerateCode(profileId)) || ''
  }
  return ''
}

export async function setBrowserProfileCode(profileId: string, code: string): Promise<string> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileSetCode) {
    return (await bindings.BrowserProfileSetCode(profileId, code)) || ''
  }
  return code.trim().toUpperCase()
}

export async function batchSetProfileTags(profileIds: string[], tags: string[], replace: boolean): Promise<boolean> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileBatchSetTags) {
    await bindings.BrowserProfileBatchSetTags(profileIds, tags, replace)
    return true
  }
  return true
}

export async function batchRemoveProfileTags(profileIds: string[], tags: string[]): Promise<boolean> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileBatchRemoveTags) {
    await bindings.BrowserProfileBatchRemoveTags(profileIds, tags)
    return true
  }
  return true
}

export async function renameBrowserTag(oldName: string, newName: string): Promise<boolean> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserRenameTag) {
    await bindings.BrowserRenameTag(oldName, newName)
    return true
  }
  return true
}

export async function fetchBrowserProfileTemplates(): Promise<BrowserProfileTemplate[]> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileTemplateList) {
    return (await bindings.BrowserProfileTemplateList()) || []
  }
  return []
}

export async function createBrowserProfileTemplate(input: BrowserProfileTemplateInput): Promise<BrowserProfileTemplate | null> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileTemplateCreate) {
    return (await bindings.BrowserProfileTemplateCreate(input)) || null
  }
  return {
    templateId: `mock-template-${Date.now()}`,
    ...input,
    keywords: input.keywords || [],
    tags: input.tags || [],
    createdAt: nowISOString(),
    updatedAt: nowISOString(),
  }
}

export async function updateBrowserProfileTemplate(templateId: string, input: BrowserProfileTemplateInput): Promise<BrowserProfileTemplate | null> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileTemplateUpdate) {
    return (await bindings.BrowserProfileTemplateUpdate(templateId, input)) || null
  }
  return {
    templateId,
    ...input,
    keywords: input.keywords || [],
    tags: input.tags || [],
    createdAt: nowISOString(),
    updatedAt: nowISOString(),
  }
}

export async function deleteBrowserProfileTemplate(templateId: string): Promise<boolean> {
  const bindings: any = await getBindings()
  if (bindings?.BrowserProfileTemplateDelete) {
    await bindings.BrowserProfileTemplateDelete(templateId)
    return true
  }
  return true
}
