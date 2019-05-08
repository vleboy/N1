const config = require('config')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const moment = require('moment')
const bcrypt = require('bcryptjs')
const uuid = require('uuid/v4')
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const TOKEN_SECRET = config.auth.secret
/**
 * 账单实体
 */
const BillMo = function () {
  return {
    sn: uuid(),
    fromRole: Model.StringValue,
    toRole: Model.StringValue,
    fromUser: Model.StringValue,
    toUser: Model.StringValue,
    fromLevel: Model.NumberValue,
    toLevel: Model.NumberValue,
    fromDisplayName: Model.StringValue,
    toDisplayName: Model.StringValue,
    action: Model.NumberValue,
    amount: Model.NumberValue,
    operator: Model.StringValue,
    remark: Model.StringValue
  }
}

const Model = {
  StringValue: 'NULL!',
  NumberValue: 0.0,
  PlatformAdminDefaultPoints: 100000000.00,
  DefaultParent: '01', // 平台
  DefaultParentName: 'PlatformAdmin',
  NoParent: '00', // 没有
  NoParentName: 'SuperAdmin',
  /**
   * 所有实体基类
   */
  baseModel: function () {
    return {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdDate: moment().utcOffset(8).format('YYYY-MM-DD'),
      createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
    }
  },
  /**
   * 随机位数数字
   */
  randomNum: (size) => {
    return Math.floor((Math.random() + Math.floor(Math.random() * 9 + 1)) * Math.pow(10, size - 1))
  },
  /**
   * token处理
   */
  token: (userInfo) => {
    return jwt.sign({
      ...userInfo,
      exp: Math.floor(Date.now() / 1000) + 86400 * 3
    }, TOKEN_SECRET)
  },
  /**
   * 密码处理
   */
  hashGen: (pass) => {
    return bcrypt.hashSync(pass, 10)
  },
  hashValidate: (pass, hash) => {
    return bcrypt.compareSync(pass, hash)
  },
  // 判断用户是否为代理
  isAgent(user) {
    if (user.role == RoleCodeEnum.Agent) {
      return true
    }
    return false
  },
  // 判断用户是否为线路商
  isManager(user) {
    if (user.role == RoleCodeEnum.Manager) {
      return true
    }
    return false
  },
  // 判断用户是否为商户
  isMerchant(user) {
    if (user.role == RoleCodeEnum.Merchant) {
      return true
    }
    return false
  },
  // 判断是否是代理管理员
  isAgentAdmin(token) {
    if (token.role == RoleCodeEnum.Agent && token.suffix == 'Agent') {
      return true
    }
    return false
  },
  // 判断是否是平台管理员
  isPlatformAdmin(token) {
    if (token.role == RoleCodeEnum.PlatformAdmin) {
      return true
    }
    return false
  },
  // 判断是否是自己
  isSelf(token, user) {
    if (token.userId == user.userId) {
      return true
    }
    return false
  },
  // 判断是否是下级
  isChild(token, user) {
    let parent = token.userId
    if (token.role == RoleCodeEnum.PlatformAdmin || this.isAgentAdmin(token)) {
      parent = this.DefaultParent
    }
    if (parent == user.parent) {
      return true
    }
    return false
  },
  // 判断是否是祖孙
  isSubChild(token, user) {
    let parent = token.userId
    if (token.role == RoleCodeEnum.PlatformAdmin || this.isAgentAdmin(token)) {
      parent = this.DefaultParent
    }
    if (user.levelIndex.indexOf(parent) > 0) {
      return true
    }
    return false
  },
  getInparamRanges(inparams) {
    let ranges = _.map(inparams, (v, i) => {
      if (v === null) {
        return null
      }
      return `${i} = :${i}`
    })
    _.remove(ranges, (v) => v === null)
    ranges = _.join(ranges, ' AND ')
    return ranges
  },
  getInparamValues(inparams) {
    const values = _.reduce(inparams, (result, v, i) => {
      if (v !== null) {
        result[`:${i}`] = v
      }
      return result
    }, {})
    return values
  }
}

module.exports = {
  Model,
  BillMo
}