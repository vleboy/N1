import { BizErr } from './Codes'
import { RoleCodeEnum } from './UserConsts'
import _ from 'lodash'
const uid = require('uuid/v4')

// 所有数据库表
export const Tables = {
  ZeusPlatformUser: "ZeusPlatformUser",
  ZeusPlatformLog: "ZeusPlatformLog",
  HeraGamePlayer: "HeraGamePlayer",
  SYSConfig: "SYSConfig",
  UserRankStat: "UserRankStat",
  PlayerBillDetail: "PlayerBillDetail",
  StatRound: "StatRound",
  StatRoundDay: "StatRoundDay",
  HeraGameRecord: "HeraGameRecord"
}

export const Model = {
  StringValue: 'NULL!',
  NumberValue: 0.0,
  PlatformAdminDefaultPoints: 100000000.00,
  DefaultParent: '01', // 平台
  DefaultParentName: 'PlatformAdmin',
  NoParent: '00', // 没有
  NoParentName: 'SuperAdmin',
  // 所有实体基类
  baseModel: function () {
    return {
      createdAt: (new Date()).getTime(),
      updatedAt: (new Date()).getTime(),
      createdDate: new Date().Format("yyyy-MM-dd")
    }
  },
  // 获取路径参数
  pathParams: (e) => {
    try {
      const params = e.pathParameters
      if (Object.keys(params).length) {
        return [0, params]
      }
    } catch (err) {
      return [BizErr.ParamErr(err.toString()), 0]
    }
  },
  // 生成唯一编号
  uuid: () => uid(),
  currentToken: async (e) => {
    if (!e || !e.requestContext.authorizer) {
      throw BizErr.TokenErr()
    }
    if (e.requestContext.authorizer.principalId == -1) {
      throw BizErr.TokenExpire()
    }
    return [0, e.requestContext.authorizer]
  },
  currentRoleToken: async (e, roleCode) => {
    if (!e || !e.requestContext.authorizer) {
      throw BizErr.TokenErr()
    } else {

      if (e.requestContext.authorizer.principalId == -1) {
        throw BizErr.TokenExpire()
      }
      if (e.requestContext.authorizer.role != roleCode) {
        throw BizErr.RoleTokenErr()
      }
    }
    return [0, e.requestContext.authorizer]
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