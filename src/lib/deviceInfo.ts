/**
 * Device Info Parser
 * Parses user agent strings to extract device, browser, and OS information
 */

export interface DeviceInfo {
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
}

/**
 * Parse a user agent string into structured device info
 */
export function parseDeviceInfo(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();
  
  // Determine device type
  let device_type: DeviceInfo['device_type'] = 'desktop';
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    device_type = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|webos|blackberry|opera mini|opera mobi|iemobile|windows phone/i.test(ua)) {
    device_type = 'mobile';
  } else if (ua) {
    device_type = 'desktop';
  } else {
    device_type = 'unknown';
  }

  // Detect browser and version
  let browser = 'Unknown';
  let browser_version = '';
  
  if (/edg\//i.test(ua)) {
    browser = 'Edge';
    browser_version = extractVersion(ua, /edg\/(\d+(\.\d+)?)/i);
  } else if (/opr\//i.test(ua) || /opera/i.test(ua)) {
    browser = 'Opera';
    browser_version = extractVersion(ua, /(?:opr|opera)[\/\s](\d+(\.\d+)?)/i);
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Chrome';
    browser_version = extractVersion(ua, /(?:chrome|crios)\/(\d+(\.\d+)?)/i);
  } else if (/safari/i.test(ua) && !/chrome|chromium|crios/i.test(ua)) {
    browser = 'Safari';
    browser_version = extractVersion(ua, /version\/(\d+(\.\d+)?)/i);
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
    browser_version = extractVersion(ua, /(?:firefox|fxios)\/(\d+(\.\d+)?)/i);
  } else if (/trident|msie/i.test(ua)) {
    browser = 'Internet Explorer';
    browser_version = extractVersion(ua, /(?:rv:|msie\s)(\d+(\.\d+)?)/i);
  }

  // Detect OS and version
  let os = 'Unknown';
  let os_version = '';
  
  if (/windows nt/i.test(ua)) {
    os = 'Windows';
    const ntVersion = extractVersion(ua, /windows nt (\d+(\.\d+)?)/i);
    os_version = mapWindowsVersion(ntVersion);
  } else if (/mac os x|macos/i.test(ua)) {
    os = 'macOS';
    os_version = extractVersion(ua, /mac os x[\/\s]?(\d+[._]\d+([._]\d+)?)?/i).replace(/_/g, '.');
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
    os_version = extractVersion(ua, /os (\d+[._]\d+([._]\d+)?)/i).replace(/_/g, '.');
  } else if (/android/i.test(ua)) {
    os = 'Android';
    os_version = extractVersion(ua, /android[\/\s]?(\d+(\.\d+)?)/i);
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
    os_version = '';
  } else if (/cros/i.test(ua)) {
    os = 'Chrome OS';
    os_version = extractVersion(ua, /cros[^\)]*?(\d+(\.\d+)?)/i);
  }

  return {
    device_type,
    browser,
    browser_version,
    os,
    os_version,
  };
}

/**
 * Extract version number from user agent using regex
 */
function extractVersion(ua: string, regex: RegExp): string {
  const match = ua.match(regex);
  return match?.[1] || '';
}

/**
 * Map Windows NT version numbers to friendly names
 */
function mapWindowsVersion(ntVersion: string): string {
  const versionMap: Record<string, string> = {
    '10.0': '10/11',
    '6.3': '8.1',
    '6.2': '8',
    '6.1': '7',
    '6.0': 'Vista',
    '5.2': 'XP x64',
    '5.1': 'XP',
  };
  return versionMap[ntVersion] || ntVersion;
}

/**
 * Get a human-readable device summary
 */
export function getDeviceSummary(info: DeviceInfo): string {
  const parts: string[] = [];
  
  if (info.browser !== 'Unknown') {
    parts.push(info.browser_version ? `${info.browser} ${info.browser_version}` : info.browser);
  }
  
  if (info.os !== 'Unknown') {
    parts.push(info.os_version ? `${info.os} ${info.os_version}` : info.os);
  }
  
  return parts.length > 0 ? parts.join(' on ') : 'Unknown device';
}
