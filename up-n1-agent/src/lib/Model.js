const config = require('config')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
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
      createdAt: (new Date()).getTime(),
      updatedAt: (new Date()).getTime(),
      createdDate: new Date().Format("yyyy-MM-dd")
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
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) * 3,
      iat: Math.floor(Date.now() / 1000) - 30
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
// 私有日期格式化方法
Date.prototype.Format = function (fmt) {
  var o = {
    "M+": this.getMonth() + 1, //月份 
    "d+": this.getDate(), //日 
    "h+": this.getHours(), //小时 
    "m+": this.getMinutes(), //分 
    "s+": this.getSeconds(), //秒 
    "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
    "S": this.getMilliseconds() //毫秒 
  };
  if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
  for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
  return fmt;
}

module.exports = {
  Model,
  BillMo
}