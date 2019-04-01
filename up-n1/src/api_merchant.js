// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const UserModel = require('./model/UserModel')
const PlayerModel = require('./model/PlayerModel')
const LogModel = require('./model/LogModel')
const MerchantModel = require('./model/MerchantModel')
const BillModel = require('./model/BillModel')
const UserCheck = require('./biz/UserCheck')
const RoleCodeEnum = require('./lib/UserConsts').RoleCodeEnum
const RoleEditProps = require('./lib/UserConsts').RoleEditProps
const GameTypeEnum = require('./lib/Consts').GameTypeEnum
const Model = require('./lib/Model').Model

/**
 * 获取商户列表
 */
router.post('/merchants', async function (ctx, next) {
  let inparam = ctx.request.body
  let token = ctx.tokenVerify
  // 列表页搜索和排序查询
  let ret = await new MerchantModel().page(token, inparam)
  // 查询每个用户余额
  let promiseArr = []
  for (let user of ret) {
    let p = new Promise(async function (resolve, reject) {
      const lastBill = await new BillModel().checkUserLastBill(user)
      user.balance = lastBill.lastBalance
      user.playerCount = await new PlayerModel().count(user.userId)
      resolve('Y')
    })
    promiseArr.push(p)
  }
  await Promise.all(promiseArr)
  // 是否需要按照余额排序
  ret = _.sortBy(ret, ['balance'])
  // 是否只显示h5商户
  if (inparam.isH5) {
    ret = _.filter(ret, function (o) {
      let index = _.findIndex(o.gameList, function (m) { return (m.code == '70000' || m.code == '80000' || m.code == '90000') })
      return index != -1 ? true : false
    })
  }
  if (inparam.sort == "desc") { ret = ret.reverse() }
  // 结果返回
  ctx.body = { code: 0, payload: ret }
})

// 为包站系统定制使用帐号查询
router.get('/merchants/:id', async function (ctx, next) {
  let params = ctx.params
  if (params.id.indexOf('_') != -1) {
    let userRet = await new UserModel().getUserByName(RoleCodeEnum.Merchant, params.id)
    ctx.userAccount = userRet.userId
  }
  return next()
})
/**
 * 获取商户信息
 */
router.get('/merchants/:id', async function (ctx, next) {
  let params = ctx.params
  if (ctx.userAccount) {
    params.id = ctx.userAccount
  }
  let token = ctx.tokenVerify
  // 业务操作
  const options = {
    ProjectionExpression: '#role,userId,createdAt,displayName,lastIP,#level,loginAt,#parent,parentName,parentRole,password,#rate,suffix,uname,username,#status,displayId,remark,gameList,parentDisplayName,parentSuffix,winloseAmountMap,companyList,sn,apiKey,loginWhiteList,transferURL,signatureUrl,subRole,chip,levelIndex,isTest',
    ExpressionAttributeNames: { '#role': 'role', '#level': 'level', '#parent': 'parent', '#rate': 'rate', '#status': 'status' }
  }
  const merchant = await new UserModel().getUser(params.id, RoleCodeEnum.Merchant, options)
  if (!Model.isPlatformAdmin(token) && params.id != token.userId && !Model.isSubChild(token, merchant)) {
    throw { "code": -1, "msg": "权限不足" }
  }
  const lastBill = await new BillModel().checkUserLastBill(merchant)
  merchant.balance = lastBill.lastBalance
  // 结果返回
  ctx.body = { code: 0, payload: merchant }
})
/**为包站系统定制使用帐号查询 */
router.post('/merchants/:id', async function (ctx, next) {
  let params = ctx.params
  if (params.id.indexOf('_') != -1) {
    let userRet = await new UserModel().getUserByName(RoleCodeEnum.Merchant, params.id)
    ctx.userAccount = userRet.userId
  }
  return next()
})
/**
 * 更新商户
 */
router.post('/merchants/:id', async function (ctx, next) {
  let params = ctx.params
  if (ctx.userAccount) {
    params.id = ctx.userAccount
  }
  let merchantInfo = ctx.request.body
  let token = ctx.tokenVerify
  //检查参数是否合法
  new UserCheck().checkUserUpdate(merchantInfo)
  // 业务操作
  const merchant = await new UserModel().getUser(params.id, RoleCodeEnum.Merchant)
  let parentUser = {}
  if (merchant.parent == Model.DefaultParent) {
    parentUser = {}
  } else {
    parentUser = await new UserModel().queryUserById(merchant.parent)
  }
  // 如果有游戏列表更新则检查
  if (merchantInfo.gameList) {
    checkGameList(merchantInfo, parentUser)
  }
  // 处理不修改密码的情况
  if (!merchantInfo.password) {
    merchantInfo.password = merchant.password
  }
  // 获取更新属性和新密码HASH
  const Merchant = {
    ...merchant, ..._.pick(merchantInfo, RoleEditProps[RoleCodeEnum.Merchant])
  }
  Merchant.passhash = Model.hashGen(Merchant.password)
  //如果isTest发生了变化也要更新所有下级的isTest
  if (merchant.isTest != merchantInfo.isTest) {
    if (merchantInfo.isTest == 0) {
      //测变正，就判断上级必须为正
      let parentInfo = await new UserModel().query({
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId=:userId',
        ProjectionExpression: 'isTest',
        ExpressionAttributeValues: {
          ':userId': merchant.parent
        }
      })
      let parentTest = 0
      if (parentInfo.Items.length > 0) {
        parentTest = parentInfo.Items[0].isTest || 0
      }
      if (parentTest != 0) {
        throw { code: -1, msg: "不能变为正式用户，该用户上级为测试用户" }
      }
    }
    Merchant.isTest = merchantInfo.isTest
  }
  const updateRet = await new UserModel().userUpdate(Merchant)

  let gameListDifference = getGameListDifference(merchant, merchantInfo)
  let isChangeGameList = gameListDifference.length == 0 ? false : true
  // 判断是否更新所有子用户的游戏或者抽成比
  if (isChangeGameList) {
    let inparam = {
      gameListAfter: merchant.gameList,
      gameListBefore: merchantInfo.gameList,
      userId: merchant.userId,
      userName: merchant.username,
      operateName: token.username
    }
    new LogModel().add('8', { gameList: merchantInfo.gameList, userId: merchant.userId }, inparam)
  }
  // 操作日志记录
  params.operateAction = '更新商户信息'
  params.operateToken = ctx.tokenVerify
  new LogModel().addOperate(params, null, updateRet)
  // 结果返回
  ctx.body = { code: 0, payload: updateRet }
})

// ==================== 以下为内部方法 ====================
/**
 * 获取减少的游戏数组
 * @param {*} userBefore 
 * @param {*} userAfter 
 */
function getGameListDifference(userBefore, userAfter) {
  let gameListBefore = []
  let gameListAfter = []
  for (let i of userBefore.gameList) {
    gameListBefore.push(i.code)
  }
  for (let j of userAfter.gameList) {
    gameListAfter.push(j.code)
  }
  return _.difference(gameListBefore, gameListAfter)
}
/**
 * 检查游戏信息是否正确
 * @param {*} merchantInfo 入参对象
 * @param {*} parentUser 上级用户信息
 */
function checkGameList(merchantInfo, parentUser) {
  // 检查是否为枚举内部数据
  let codeArr = []
  let oldGameList = merchantInfo.gameList
  let newGameList = []
  for (let item of oldGameList) {
    codeArr.push(item.code)
    let gameType = GameTypeEnum[item.code]
    if (gameType) {
      newGameList.push({ ...gameType, ...item })
    } else {
      throw { "code": -1, "msg": `游戏列表中有不能识别的游戏大类编号：${item.code}`, "params": ["gameList"] }
    }
  }
  merchantInfo.gameList = newGameList
  // 检查是否有相同的游戏
  if (_.uniq(codeArr).length != codeArr.length) {
    throw { "code": -1, "msg": "每款游戏只能选择一次", "params": ["gameList"] }
  }
  // 校验游戏是否正确，占成是否正确
  let parentGameList = parentUser.gameList || []
  let errArr = []
  if (merchantInfo.parent == Model.DefaultParent) {    //如果上级是直属平台
    for (let item in GameTypeEnum) {
      parentGameList.push(item)
    }
    for (let item of merchantInfo.gameList) {
      if (!_.includes(parentGameList, item.code) || item.rate > 100 || item.rate < 0) {
        errArr.push(item)
      }
    }
  } else {
    for (let item of merchantInfo.gameList) {
      let index = _.findIndex(parentGameList, function (o) {
        return o.code == item.code
      })
      if (index == -1 || +item.rate > +parentGameList[index].rate) {
        errArr.push(item)
      }
    }
  }
  if (errArr.length > 0) {
    throw { "code": -1, "msg": "游戏列表中的游戏参数不正确", "params": errArr }
  }
}


module.exports = router