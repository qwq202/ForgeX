/**
 * IPC channel names — domain-scoped, no free-form strings in call sites.
 */
export const IpcChannels = {
  // App
  'app:getInfo': 'app:getInfo',
  'app:getGrokBuildInfo': 'app:getGrokBuildInfo',
  'app:openExternal': 'app:openExternal',
  'app:showItemInFolder': 'app:showItemInFolder',

  // Projects
  'projects:list': 'projects:list',
  'projects:openDirectory': 'projects:openDirectory',
  'projects:add': 'projects:add',
  'projects:remove': 'projects:remove',
  'projects:get': 'projects:get',
  'projects:touch': 'projects:touch',

  // Sessions
  'sessions:list': 'sessions:list',
  'sessions:create': 'sessions:create',
  'sessions:rename': 'sessions:rename',
  'sessions:delete': 'sessions:delete',
  'sessions:get': 'sessions:get',

  // Messages
  'messages:list': 'messages:list',
  'messages:create': 'messages:create',
  'messages:update': 'messages:update',
  'messages:listToolCalls': 'messages:listToolCalls',

  // Files
  'files:listTree': 'files:listTree',
  'files:read': 'files:read',
  'files:watch': 'files:watch',
  'files:unwatch': 'files:unwatch',

  // Git
  'git:status': 'git:status',
  'git:diff': 'git:diff',
  'git:discard': 'git:discard',

  // Terminal
  'terminal:create': 'terminal:create',
  'terminal:write': 'terminal:write',
  'terminal:resize': 'terminal:resize',
  'terminal:dispose': 'terminal:dispose',
  'terminal:list': 'terminal:list',

  // Agent
  'agent:start': 'agent:start',
  'agent:sendMessage': 'agent:sendMessage',
  'agent:cancel': 'agent:cancel',
  'agent:stop': 'agent:stop',
  'agent:restart': 'agent:restart',
  'agent:getState': 'agent:getState',
  'agent:respondApproval': 'agent:respondApproval',

  // Settings
  'settings:get': 'settings:get',
  'settings:update': 'settings:update',

  // Events (main → renderer)
  'event:agent': 'event:agent',
  'event:terminal:data': 'event:terminal:data',
  'event:terminal:exit': 'event:terminal:exit',
  'event:file:change': 'event:file:change',
  'event:log': 'event:log',
  'event:approval': 'event:approval'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
