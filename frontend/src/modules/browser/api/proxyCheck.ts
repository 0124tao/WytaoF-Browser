import type { ProxyCheckSettings } from '../types'
import { getBindings } from './runtime'

export function createDefaultProxyCheckSettings(): ProxyCheckSettings {
  return {
    bridgeStartTimeoutMs: 15000,
    speedTargetId: 'google_204',
    ipHealthTargetId: 'cf_trace',
    targets: [
      {
        id: 'google_204',
        name: 'Google 204',
        type: 'speed',
        url: 'http://www.gstatic.com/generate_204',
        timeoutMs: 10000,
        expectedStatus: [204],
      },
      {
        id: 'cf_trace',
        name: 'Cloudflare Trace',
        type: 'ip_health',
        url: 'https://www.cloudflare.com/cdn-cgi/trace',
        parser: 'cloudflare_trace',
        timeoutMs: 20000,
        expectedStatus: [200],
      },
      {
        id: 'ippure_json',
        name: 'IPPure JSON',
        type: 'ip_health',
        url: 'https://my.ippure.com/v1/info',
        parser: 'json',
        timeoutMs: 20000,
        expectedStatus: [200],
      },
    ],
  }
}

export async function fetchProxyCheckSettings(): Promise<ProxyCheckSettings> {
  const bindings: any = await getBindings()
  if (bindings?.GetProxyCheckSettings) {
    return (await bindings.GetProxyCheckSettings()) || createDefaultProxyCheckSettings()
  }
  return createDefaultProxyCheckSettings()
}

export async function saveProxyCheckSettings(settings: ProxyCheckSettings): Promise<boolean> {
  const bindings: any = await getBindings()
  if (bindings?.SaveProxyCheckSettings) {
    await bindings.SaveProxyCheckSettings(settings)
    return true
  }
  return true
}
