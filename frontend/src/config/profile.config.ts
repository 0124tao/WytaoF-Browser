import { projectConfig } from './project.config'
import { PROJECT_GITHUB_URL } from './links'

export type ProfileIconKey =
  | 'book-open'
  | 'globe'
  | 'message-square'
  | 'github'
  | 'mail'
  | 'external-link'

export interface ProfileChannelConfig {
  name: string
  description: string
  detail: string
  href?: string
  icon?: ProfileIconKey
}

export interface AuthorProfileConfig {
  name: string
  initial: string
  title: string
  bio: string
  location: string
  joinDate: string
  email: string
  website: string
  github: string
  skills: string[]
  channels: ProfileChannelConfig[]
}

export interface ProjectProfileActionConfig {
  label: string
  href: string
  icon: ProfileIconKey
}

export interface ProjectProfileConfig {
  name: string
  introBadge: string
  introText: string
  techStack: string[]
  description: string
  actions: ProjectProfileActionConfig[]
}

export interface RemoteAuthorSourceConfig {
  authorURL: string
  timeoutMs: number
}

export interface ProfilePageLocalConfig {
  remoteAuthor: RemoteAuthorSourceConfig
  defaultAuthor: AuthorProfileConfig
  project: ProjectProfileConfig
}

export const profilePageConfig: ProfilePageLocalConfig = {
  remoteAuthor: {
    // 留空时直接使用本地默认资料；需要远程个人资料时再替换为真实地址。
    // https://raw.githubusercontent.com/<user>/<repo>/main/author.json
    authorURL: '',
    timeoutMs: 1000,
  },
  defaultAuthor: {
    name: '蔚蓝海岸',
    initial: '蔚',
    title: '个人自用版',
    bio: '个人自用的本地指纹浏览器环境管理工具。',
    location: '',
    joinDate: '',
    email: '',
    website: '',
    github: PROJECT_GITHUB_URL,
    skills: ['Wails', 'React', 'TypeScript'],
    channels: [],
  },
  project: {
    name: projectConfig.name,
    introBadge: projectConfig.name,
    introText: '是一个个人自用版本地指纹浏览器环境管理工具。',
    techStack: ['Wails', 'React', 'TypeScript'],
    description: '项目当前聚焦浏览器实例隔离、代理池配置、浏览器内核管理、标签检索和快捷启动等核心能力，定位为个人自用版，适合本地测试和个人环境管理。',
    actions: [
      {
        label: '查看源码',
        href: PROJECT_GITHUB_URL,
        icon: 'github',
      },
      {
        label: '下载发布版',
        href: `${PROJECT_GITHUB_URL}/releases`,
        icon: 'globe',
      },
    ],
  },
}

export default profilePageConfig
