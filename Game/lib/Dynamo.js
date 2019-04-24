// 所有数据库表
const Tables = {
  ZeusPlatformLog: "ZeusPlatformLog",
  SYSConfig: "SYSConfig",
  PlayerBillDetail: "PlayerBillDetail",
  StatRound: "StatRound",
  StatRoundDay: "StatRoundDay",
  HeraGameRecord: "HeraGameRecord"
}

const Model = {
  StringValue: 'NULL!',
  NumberValue: 0.0,
  PlatformAdminDefaultPoints: 100000000.00,
  DefaultParent: '01', // 平台
  DefaultParentName: 'PlatformAdmin',
  NoParent: '00', // 没有
  NoParentName: 'SuperAdmin'
}

const RoleCodeEnum = {
  'SuperAdmin': '0',
  'PlatformAdmin': '1',
  'Manager': '10',
  'Merchant': '100',
  'Agent': '1000',
  'Player': '10000'
}

module.exports = {
  Tables,
  Model,
  RoleCodeEnum
}