const uuid = require('uuid/v4')
// ==================== 以下是全系统用户实体 ====================
// 普通状态枚举
const StatusEnum = {
  Enable: 1,
  Disable: 0
}

// 角色编码枚举
const RoleCodeEnum = {
  'SuperAdmin': '0',
  'PlatformAdmin': '1',
  'Manager': '10',
  'Merchant': '100',
  'Agent': '1000',
  'Player': '10000'
}
const Model = {
  StringValue: 'NULL!',
  NumberValue: 0.0,
  PlatformAdminDefaultPoints: 100000000.00,
  DefaultParent: '01',                    // 平台
  DefaultParentName: 'PlatformAdmin',
  NoParent: '00',                         // 没有
  NoParentName: 'SuperAdmin'
}
/**
 * 角色基类
 */
const UserRole = function () {
  return {
    role: Model.StringValue,              // 角色
    userId: uuid(),                       // 用户ID
    username: Model.StringValue,          // 完整账号名
    uname: Model.StringValue,             // 帐号名
    password: Model.StringValue,          // 密码
    passhash: Model.StringValue,          // 密码hash
    parent: Model.NoParent,               // 默认没有上级
    parentRole: Model.NoParent,           // 默认没有上级角色

    level: Model.NumberValue,             // 层级
    levelIndex: Model.StringValue,        // 层级索引

    lastIP: Model.StringValue,            // 最后IP
    loginAt: Date.now(),                  // 登录时间
    status: StatusEnum.Enable,            // 状态

    adminName: Model.StringValue,         // 管理帐号的管理员姓名
    adminEmail: Model.StringValue,        // 管理帐号的管理员邮箱
    adminContact: Model.StringValue       // 管理帐号的管理员联系方式
  }
}
/**
 * 平台角色基类
 */
const PlatformBaseBizRole = function () {
  return {
    ...UserRole(),
    parent: Model.DefaultParent,          // 默认上级平台
    parentName: Model.DefaultParentName,  // 默认上级平台名称
    displayId: Model.NumberValue,         // 显示ID
    displayName: Model.StringValue,       // 显示名称
    suffix: Model.StringValue,            // 前缀
    gameList: [],                         // 游戏类型列表
    points: Model.NumberValue,            // 初始积分
    rate: Model.NumberValue,              // 抽成比
    remark: Model.StringValue,            // 备注
    chip: []                              // 限红
  }
}
/**
 * 角色实体
 */
const RoleModels = {
  '0': function () {
    return {
      ...UserRole(),
      parentName: Model.NoParentName,
      role: RoleCodeEnum['SuperAdmin'],
      displayName: '超级管理员',
      suffix: 'NAPlay'
    }
  },
  '1': function () {
    return {
      ...UserRole(),
      parentName: Model.NoParentName,
      role: RoleCodeEnum['PlatformAdmin'],
      subRole: 'admin',
      displayName: '平台管理员',
      suffix: 'Platform',
      points: Model.PlatformAdminDefaultPoints
    }
  },
  '10': function () {
    return { // 线路商
      ...PlatformBaseBizRole(),
      // limit: Model.NumberValue,             // 可用名额
      managerEmail: Model.StringValue,      // 线路商邮箱
      hostName: Model.StringValue,          // 负责人姓名
      hostContact: Model.StringValue        // 负责人联系方式
    }
  },
  '100': function () {
    return { // 商户
      ...PlatformBaseBizRole(),
      msn: Model.StringValue,               // 线路号
      apiKey: uuid(),                       // APIKEY
      frontURL: Model.StringValue,          // 商户站点
      loginWhiteList: '0.0.0.0',            // 登录白名单
      merchantEmail: Model.StringValue,     // 商户邮箱
      hostName: Model.StringValue,          // 负责人姓名
      hostContact: Model.StringValue,       // 负责人联系方式
      moneyURL: Model.StringValue,          // 商户充值站点
      registerURL: Model.StringValue,       // 商户注册站点
      feedbackURL: Model.StringValue,       // 客服连接
      sn: Model.StringValue,                // 商户邀请码
      launchImg: Model.StringValue          // 商户启动图片
    }
  },
  '1000': function () {
    return {// 代理
      ...PlatformBaseBizRole(),
      vedioMix: Model.NumberValue,            // 电子游戏洗码比
      liveMix: Model.NumberValue,             // 真人视讯洗码比
      sn: Model.StringValue,                  // 代理邀请码
      feedbackURL: Model.StringValue,         // 客服连接
      launchImg: Model.StringValue            // 代理启动图片
    }
  },
  '10000': function () {
    return {}
  }
}
/**
 * 角色显示属性
 */
const RoleDisplay = {
  '0': [],
  '1': [// 平台管理员
    'userId',
    'role',
    'suffix',
    'username',

    'parent',
    'parentName',
    'parentRole',
    'displayName',
    'level',
    'subRole'           // 二级权限

    // 'password',
  ],
  '10': [// 线路商
    'userId',
    'role',
    'suffix',
    'username',

    'parent',
    'parentName',
    'parentDisplayName',
    'parentRole',
    'displayName',
    'level',

    'displayId',        // 显示ID
    'updatedAt'

    // 'password',
    // 'remark'
  ],
  '100': [// 商户
    'userId',
    'role',
    'suffix',
    'username',

    'parent',
    'parentName',
    'parentDisplayName',
    'parentRole',
    'displayName',
    'level',

    'msn',            // 商户线路号
    'apiKey',         // 商户APIKEY

    'displayId',
    'updatedAt',

    'moneyURL',
    'registerURL',
    'sn',
    'feedbackURL',  // 客服链接
    'launchImg'

    // 'password',
    // 'remark'
  ],
  '1000': [// 代理
    'userId',
    'role',
    'suffix',
    'username',

    'parent',
    'parentName',
    'parentDisplayName',
    'parentRole',
    'displayName',
    'level',

    'vedioMix',       // 电子游戏洗码比
    'liveMix',        // 真人视讯洗码比

    'displayId',
    'updatedAt',
    'sn',
    'feedbackURL',  // 客服链接
    'launchImg',
    'gameList',
    'rate'

    // 'password',
    // 'remark'
  ]
}
/**
 * 角色可修改属性
 */
const RoleEditProps = {
  '0': [],
  '1': [],
  '10': [// 线路商
    'hostName',
    'hostContact',
    'managerEmail',
    'adminName',
    'adminEmail',
    'adminContact',
    'password',
    'rate',
    'gameList',

    // 'limit',          // 线路商可用名额

    'remark'
  ],
  '100': [// 商户
    'hostName',
    'hostContact',
    'merchantEmail',
    'adminName',
    'adminEmail',
    'adminContact',
    'password',
    'rate',
    'gameList',

    'loginWhiteList', // 商户白名单
    'frontURL',       // 商户前端URL

    'remark',

    'moneyURL',
    'registerURL',
    'feedbackURL',    // 客服链接
    'launchImg'
  ],
  '1000': [// 代理
    'password',
    'rate',
    'gameList',

    'vedioMix',     // 电子游戏洗码比
    'liveMix',      // 真人视讯洗码比
    'remark',
    'feedbackURL',  // 客服链接
    'launchImg',
    'chip'          // 限红
  ],
  '10000': []
}

module.exports = {
  StatusEnum,
  RoleCodeEnum,
  RoleModels,
  RoleDisplay,
  RoleEditProps,
  Model
}