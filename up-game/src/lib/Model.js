const config = require('config')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const bcrypt = require('bcryptjs')
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const TOKEN_SECRET = config.auth.secret
// const BizErr = require('../lib/Codes').BizErr
// const GlobalConfig = require("../util/config")

// const AWS = require('aws-sdk')
// AWS.config.update({ region: 'ap-southeast-1' })
// const dbClient = new AWS.DynamoDB.DocumentClient()
// const db$ = (action, params) => {
//   return dbClient[action](params).promise()
// }
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
  //生成随机数
  getLengthNum: function (len) {
    let number = Number.parseInt(Math.random() * Math.pow(10, len))
    if (number > Math.pow(10, len - 1) && number < Math.pow(10, len)) {
      return number.toString()
    } else {
      return this.getLengthNum(len)
    }
  },

  // /**
  //  * 生成唯一编号
  //  */
  // uucode: async (type, size) => {
  //   const ret = await db$('query', {
  //     TableName: GlobalConfig.TABLE_NAMES.ZeusPlatformCode,
  //     KeyConditionExpression: '#type = :type',
  //     ExpressionAttributeNames: {
  //       '#type': 'type'
  //     },
  //     ExpressionAttributeValues: {
  //       ':type': type,
  //     }
  //   })
  //   // 所有编号都被占用
  //   if (ret.Items.length >= Math.pow(10, size) - Math.pow(10, size - 1)) {
  //     throw BizErr.CodeFullError()
  //   }
  //   // 所有占用编号组成数组
  //   let codeArr = new Array()
  //   for (let item of ret.Items) {
  //     codeArr.push(parseInt(item.code))
  //   }
  //   // 获取指定位数的随机数
  //   let randomCode = Math.floor((Math.random() + Math.floor(Math.random() * 9 + 1)) * Math.pow(10, size - 1))
  //   // 判断随机线路号是否已被占用
  //   while (codeArr.indexOf(randomCode) != -1) {
  //     randomCode = Math.floor((Math.random() + Math.floor(Math.random() * 9 + 1)) * Math.pow(10, size - 1))
  //   }
  //   // 编号插入
  //   // await db$('put', {TableName: GlobalConfig.TABLE_NAMES.ZeusPlatformCode,Item: {type: type,code: randomCode.toString()}})
  //   // 返回编号
  //   return randomCode.toString()
  // },
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
  hashValidate: async (pass, hash) => {
    const result = await bcrypt.compare(pass, hash)
    return result
  },
  // 判断用户是否为代理
  isAgent(user) {
    if (user.role == RoleCodeEnum['Agent']) {
      return true
    }
    return false
  },
  // 判断用户是否为线路商
  isManager(user) {
    if (user.role == RoleCodeEnum['Manager']) {
      return true
    }
    return false
  },
  // 判断用户是否为商户
  isMerchant(user) {
    if (user.role == RoleCodeEnum['Merchant']) {
      return true
    }
    return false
  },
  // 判断是否是代理管理员
  isAgentAdmin(token) {
    if (token.role == RoleCodeEnum['Agent'] && token.suffix == 'Agent') {
      return true
    }
    return false
  },
  // 判断是否是平台管理员
  isPlatformAdmin(token) {
    if (token.role == RoleCodeEnum['PlatformAdmin']) {
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
    if (token.role == RoleCodeEnum['PlatformAdmin'] || this.isAgentAdmin(token)) {
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
    if (token.role == RoleCodeEnum['PlatformAdmin'] || this.isAgentAdmin(token)) {
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
  Model
}