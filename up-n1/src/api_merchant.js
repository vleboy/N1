// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const uuid = require('uuid/v4')
const NP = require('number-precision')
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
const { GameTypeEnum, GameStateEnum } = require('./lib/Consts')
const Model = require('./lib/Model').Model

/**
 * 获取商户列表
 */
router.post('/merchants', async function (ctx, next) {
  let inparam = ctx.request.body
  let token = ctx.tokenVerify
  // 列表页搜索和排序查询
  let ret = await new MerchantModel().page(token, inparam)
  // 是否只显示h5商户
  if (inparam.isH5) {
    ret = _.filter(ret, (o) => {
      let index = _.findIndex(o.gameList, (m) => { return (m.code == '70000' || m.code == '80000' || m.code == '90000') })
      return index != -1 ? true : false
    })
  }
  // 查询每个商户余额和玩家数量
  let promiseArr = []
  for (let user of ret) {
    promiseArr.push(new BillModel().checkUserBalance(user))
    promiseArr.push(new PlayerModel().count(user.userId))
  }
  let resArr = await Promise.all(promiseArr)
  for (let i = 0; i < ret.length; i++) {
    ret[i].balance = resArr[i * 2]
    ret[i].playerCount = resArr[i * 2 + 1]
  }
  // 是否需要按照余额排序
  ret = _.sortBy(ret, ['balance'])
  if (inparam.sort == 'desc') { ret = ret.reverse() }
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
  merchant.balance = await new BillModel().checkUserBalance(merchant)
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

  let [gameListDifference, differenceList, rateBool, addArr] = getGameListDifference(merchant, merchantInfo)
  let isChangeGameList = gameListDifference.length != 0 || addArr.length != 0 || rateBool ? true : false
  // 判断是否更新所有子用户的游戏或者抽成比
  if (isChangeGameList) {
    let detail = `商户${merchant.username}的游戏列表：`
    for (let item of differenceList) {
      detail += `更新【${item.name}抽成比为${item.rate}】 `
    }
    for (let item of gameListDifference) {
      detail += `删除【${GameTypeEnum[item].name}】`
    }
    for (let item of addArr) {
      detail += `添加【${GameTypeEnum[item].name}】`
    }
    params.operateAction = detail
    // let inparam = {
    //   gameListAfter: merchant.gameList,
    //   gameListBefore: merchantInfo.gameList,
    //   userId: merchant.userId,
    //   userName: merchant.username,
    //   operateName: token.username
    // }
    // new LogModel().add('8', { gameList: merchantInfo.gameList, userId: merchant.userId }, inparam)
  } else {
    params.operateAction = `更新商户${merchant.username}的基本信息`
  }
  params.operateToken = ctx.tokenVerify
  new LogModel().addOperate(params, null, updateRet)
  // 结果返回
  ctx.body = { code: 0, payload: updateRet }
})

/**
 * 商户自主创建玩家
 * userName
 * userPwd
 */
router.post('/merchant/player/create', async (ctx, next) => {
  let inparam = ctx.request.body
  let token = ctx.tokenVerify
  // 检查商户
  let userInfo = await new UserModel().getUser(token.userId, RoleCodeEnum.Merchant)
  if (userInfo.status == 0) {
    throw { code: -1, msg: "商户已停用" }
  }
  // 检查玩家
  let userName = `${userInfo.suffix}_${inparam.userName}`
  let playerModel = new PlayerModel()
  let playerInfo = await playerModel.getItem({
    ConsistentRead: true,
    ProjectionExpression: 'userId',
    Key: { 'userName': userName }
  })
  if (!_.isEmpty(playerInfo.Item)) {
    throw { code: -1, msg: "玩家已存在" }
  }
  else if (!inparam.userPwd) {
    throw { code: -1, msg: "请输入玩家密码" }
  }
  // 生成玩家的userId
  let userId = _.random(100000, 999999)
  while (await playerModel.isUserIdExit(userId)) {
    userId = _.random(100000, 999999)
  }
  await playerModel.putItem({
    userName: userName,
    userId: userId,
    password: inparam.userPwd,
    buId: userInfo.displayId,
    role: 10000,
    state: 1,
    balance: 0,
    msn: _.padStart(userInfo.msn, 3, '0'),
    merchantName: userInfo.displayName,
    parent: userInfo.userId,
    parentName: userInfo.username,
    nickname: 'NULL!',
    gameState: GameStateEnum.OffLine,
    parentSn: userInfo.sn
  })
  ctx.body = { code: 0 }
})

/**
 * 商户给玩家上下分
 * userName
 * action
 * amount
 */
router.post('/merchant/player/point', async (ctx, next) => {
  let inparam = ctx.request.body
  let token = ctx.tokenVerify
  // 检查入参
  if (!inparam.userName || !inparam.action || !inparam.amount) {
    throw { code: -1, msg: "请输入金额" }
  }
  // 玩家操作的金额小数点两位处理
  inparam.amount = NP.round(+inparam.amount, 2)
  // 检查商户
  let userInfo = await new UserModel().getUser(token.userId, RoleCodeEnum.Merchant)
  if (userInfo.status == 0) {
    throw { code: -1, msg: "商户已停用" }
  }
  // 检查玩家
  let playerModel = new PlayerModel()
  let playerInfo = await playerModel.getItem({
    ConsistentRead: true,
    ProjectionExpression: 'userId,userName,#parent,#state,gameState,balance',
    ExpressionAttributeNames: { '#parent': 'parent', '#state': 'state' },
    Key: { 'userName': inparam.userName }
  })
  playerInfo = playerInfo.Item
  if (playerInfo.state == '0') {
    throw { code: -1, msg: "玩家已停用" }
  }
  if (playerInfo.parent != token.userId) {
    throw { code: -2, msg: "请勿在相同浏览器登录不同用户" }
  }
  // 提现时需要离线玩家
  if (inparam.action == -1 && playerInfo.gameState != GameStateEnum.OffLine) {
    await playerModel.updateOffline(inparam.userName)
  }
  // 充值，获取商户的点数并检查商户的点数是否足够
  if (inparam.action == 1) {
    let userBalance = await new BillModel().checkUserBalance(userInfo)
    if (userBalance < inparam.amount) {
      throw { code: -1, msg: "商户余额不足" }
    }
  }
  // 提现，检查玩家的点数是否足够
  else if (inparam.action == -1) {
    let usage = inparam.action == -1 ? 'billout' : 'billin' // 提现需要检查余额绝对正确
    let palyerBalance = await playerModel.getNewBalance({ userName: playerInfo.userName, userId: playerInfo.userId, balance: playerInfo.balance, usage })
    if (palyerBalance == 'err') {
      throw { code: -1, msg: "账务正在结算中，请联系管理员" }
    }
    if (palyerBalance < inparam.amount) {
      throw { code: -1, msg: "玩家余额不足" }
    }
  }
  // 更新玩家余额
  let currentBalanceObj = await playerModel.updatePlayerBalance({
    userName: playerInfo.userName,
    userId: playerInfo.userId,
    amt: inparam.action == 1 ? Math.abs(inparam.amount) : Math.abs(inparam.amount) * -1
  })
  // 写入用户流水表
  let userBill = {
    sn: uuid(),
    fromRole: inparam.action == 1 ? '100' : '10000',
    toRole: inparam.action == 1 ? '10000' : '100',
    fromUser: inparam.action == 1 ? userInfo.username : playerInfo.userName,
    toUser: inparam.action == 1 ? playerInfo.userName : userInfo.username,
    amount: inparam.action == 1 ? Math.abs(inparam.amount) * -1 : Math.abs(inparam.amount),
    operator: userInfo.username,
    remark: inparam.action == 1 ? "上分" : "下分",
    typeName: "中心钱包",
    username: userInfo.username,
    userId: userInfo.userId,
    fromDisplayName: playerInfo.userName,
    toDisplayName: playerInfo.userName,
    fromLevel: userInfo.level,
    toLevel: 10000,
    action: -inparam.action
  }
  // 写入玩家流水表
  let playerBill = {
    sn: uuid(),
    action: inparam.action,
    type: 11,  //中心钱包
    gameType: 1,
    userId: playerInfo.userId,
    userName: playerInfo.userName,
    parent: playerInfo.parent,
    originalAmount: currentBalanceObj.originalAmount,
    amount: currentBalanceObj.amount,
    balance: currentBalanceObj.balance
  }
  await playerModel.playerBillTransfer(userBill, playerBill)
  // 通知游戏端
  axios.post(config.env.GAME_NOTICE_URL, { userId: playerInfo.userId, balance: currentBalanceObj.balance, amount: currentBalanceObj.amount })
  ctx.body = { code: 0 }
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
  let differenceList = []
  let rateBool = false
  for (let i of userBefore.gameList) {
    gameListBefore.push(i.code)
    for (let j of userAfter.gameList) {
      if (i.code == j.code && i.rate != j.rate) {
        rateBool = true
        differenceList.push(j)
      }
    }
  }
  for (let j of userAfter.gameList) {
    gameListAfter.push(j.code)
  }
  return [_.difference(gameListBefore, gameListAfter), differenceList, rateBool, _.difference(gameListAfter, gameListBefore)]
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