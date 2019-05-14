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
const LogModel = require('./model/LogModel')
const PlayerModel = require('./model/PlayerModel')
const CompanyEnum = require('./lib/Consts').CompanyEnum
const GameListEnum = require('./lib/Consts').GameListEnum
const GameModel = require('./model/GameModel')
const GameCheck = require('./biz/GameCheck')
const RoleCodeEnum = require('./lib/Consts').RoleCodeEnum
const GameTypeEnum = require('./lib/Consts').GameTypeEnum
const gameMapTemp = {}

// 【系统对外API接口】

/**
 * 创建游戏
 */
router.post('/games', async (ctx, next) => {
  let gameInfo = ctx.request.body
  let token = ctx.tokenVerify
  //检查参数是否合法
  new GameCheck().checkGame(gameInfo)
  // 业务操作
  const addGameRet = await new GameModel().addGame(gameInfo)
  // 操作日志记录
  gameInfo.operateAction = '创建游戏'
  gameInfo.operateToken = token
  new LogModel().addOperate(gameInfo, null, addGameRet)
  // 结果返回
  ctx.body = { code: 0, payload: addGameRet }
})

/**
 * 游戏列表
 */
router.post('/gameList', async (ctx, next) => {
  let inparam = ctx.request.body
  //检查参数是否合法
  new GameCheck().checkQuery(inparam)
  // 普通游戏列表
  let ret = await new GameModel().list(inparam)
  // 结果返回
  ctx.body = { code: 0, payload: ret }
})

/**
 * 单个游戏
 */
router.get('/gameOne/:gameType/:gameId', async (ctx, next) => {
  let gameParams = ctx.params
  // 业务操作
  const ret = await new GameModel().getOne(gameParams.gameType, gameParams.gameId)
  // 结果返回
  ctx.body = { code: 0, payload: ret }
})

/**
 * 游戏编辑
 */
router.post('/gameUpdate', async (ctx, next) => {
  let inparam = ctx.request.body
  // 检查参数是否合法
  new GameCheck().checkUpdateGame(inparam)
  // 业务操作
  const ret = await new GameModel().updateGame(inparam)
  // 操作日志记录
  inparam.operateAction = '更新游戏'
  inparam.operateToken = ctx.tokenVerify
  new LogModel().addOperate(inparam, null, ret)
  // 结果返回
  ctx.body = { code: 0, payload: ret }
})

/**
 * 游戏状态变更
 */
router.post('/gameChangeStatus', async (ctx, next) => {
  let inparam = ctx.request.body
  //检查参数是否合法
  new GameCheck().checkStatus(inparam)
  // 业务操作
  const ret = await new GameModel().changeStatus(inparam.gameType, inparam.gameId, inparam.status)
  // 操作日志记录
  inparam.operateAction = '游戏状态变更'
  inparam.operateToken = ctx.tokenVerify
  new LogModel().addOperate(inparam, null, ret)
  // 结果返回
  ctx.body = { code: 0, payload: ret }
})

/**
 * 游戏排序
 */
router.post('/gameChangeOrder', async (ctx, next) => {
  let inparam = ctx.request.body
  //检查参数是否合法
  new GameCheck().checkOrder(inparam)
  // 业务操作
  const ret = await new GameModel().updateItem({
    Key: { gameType: inparam.gameType, gameId: inparam.gameId },
    UpdateExpression: 'SET sortOrder=:sortOrder',
    ExpressionAttributeValues: {
      ':sortOrder': inparam.sortOrder
    }
  })
  // 结果返回
  ctx.body = { code: 0, payload: ret }
})

// 【大厅对外API接口】

// 大厅使用，游戏列表
router.get('/gameList/:gameType', async (ctx, next) => {
  let inparam = ctx.params
  const isAll = ctx.query.isAll === true || false
  // 优先从缓存读取
  if (isAll && gameMapTemp['all']) {
    return ctx.body = { code: 0, payload: gameMapTemp['all'] }
  }
  if (gameMapTemp[inparam.gameType]) {
    return ctx.body = { code: 0, payload: gameMapTemp[inparam.gameType] }
  }
  //默认查启用状态，isALL代表全查询
  inparam.query = { gameStatus: 1 }
  if (isAll) {
    delete inparam.query
  }
  new GameCheck().checkQuery(inparam)
  // 普通游戏列表
  let ret = await new GameModel().list(inparam)
  // 设置缓存
  if (isAll) {
    gameMapTemp['all'] = ret
  }
  if (inparam.gameType) {
    gameMapTemp[inparam.gameType] = ret
  }
  // 结果返回
  ctx.body = { code: 0, payload: ret }
})
// 大厅使用，通过玩家id获取商户的游戏列表(70000/80000/90000)
router.get('/player/gameList/:userId', async (ctx, next) => {
  //1,获取入参
  const userId = ctx.params.userId
  //2,从缓存读取
  if (gameMapTemp[userId]) {
    return ctx.body = gameMapTemp[userId]
  }
  //3,查询玩家
  let playerInfo = await new PlayerModel().getPlayerById(userId)
  //4,获取商户下的游戏列表
  let userInfo = await new UserModel().queryUserById(playerInfo.parent, { ProjectionExpression: "gameList" })
  //5,查找游戏是否含有70000/80000/90000
  let resArr = []
  for (let game of userInfo.gameList) {
    if (game.code == '70000' || game.code == '80000' || game.code == '90000') {
      resArr.push(await new GameModel().list({ gameType: game.code.toString(), query: { gameStatus: 1 } }))
    }
  }
  ctx.body = gameMapTemp[userId] = _.flatten(resArr)
})


// 【包站对外API接口】

/**
 * 游戏类别
 */
router.post('/gameType', async (ctx, next) => {
  let inparam = ctx.request.body
  // 全部游戏类别
  if (!inparam.parent || inparam.parent == RoleCodeEnum['PlatformAdmin'] || inparam.parent == '01') {
    let gameTypeArr = []
    for (let item in GameTypeEnum) {
      gameTypeArr.push(GameTypeEnum[item])
    }
    return ctx.body = { code: 0, payload: gameTypeArr }
  }
  // 上级游戏类别
  const ret = await new UserModel().queryUserById(inparam.parent, { ProjectionExpression: "gameList" })
  ret.gameList = ret.gameList || []
  // 刷新最新游戏类型内容
  let newGameList = []
  for (let item of ret.gameList) {
    newGameList.push(GameTypeEnum[item.code])
  }
  ret.gameList = newGameList
  // 结果返回
  ctx.body = { code: 0, payload: ret.gameList }
})

// 为包站系统定制使用帐号查询
router.post('/companySelect', async (ctx, next) => {
  let inparam = ctx.request.body
  if (inparam.parentAccount && inparam.parentAccount != '01') {
    let UserRet = await new UserModel().getUserByName(RoleCodeEnum.Merchant, inparam.parentAccount)
    inparam.parent = UserRet.userId
  } else if (inparam.parentAccount == '01') {
    inparam.parent = '01'
  }
  return next()
})
/**
 * 获取运营商
 */
router.post('/companySelect', async (ctx, next) => {
  let inparam = ctx.request.body
  let gameTypeArr = []
  // 管理员或上级是管理员，则获取全部游戏类别
  if (!inparam.parent || inparam.parent == RoleCodeEnum.PlatformAdmin || inparam.parent == '01') {
    return ctx.body = { code: 0, payload: CompanyEnum }
  }
  // 否则只查询上级有的游戏
  const userRet = await new UserModel().queryUserById(inparam.parent, { ProjectionExpression: "gameList" })
  let parentGameList = userRet.gameList || []
  // 刷新最新游戏类型内容
  let newGameList = []
  for (let item of parentGameList) {
    newGameList.push({ company: item.company })
  }
  //去重
  newGameList = _.uniqWith(newGameList, _.isEqual)
  for (let item of newGameList) {
    for (let company of CompanyEnum) {
      if (item.company == company.company) {
        gameTypeArr.push({ company: item.company, companyName: company.companyName })
      }
    }
  }
  // 结果返回
  ctx.body = { code: 0, payload: gameTypeArr }
})

// 为包站系统定制使用帐号查询
router.post('/gameBigType', async (ctx, next) => {
  let inparam = ctx.request.body
  if (inparam.userAccount) {
    let UserRet = await new UserModel().getUserByName(RoleCodeEnum.Merchant, inparam.userAccount)
    inparam.userId = UserRet.userId
  }
  return next()
})
/**
 * 获取指定运营商的游戏大类
 */
router.post('/gameBigType', async (ctx, next) => {
  let inparam = ctx.request.body
  if (!inparam.companyIden) {
    return ctx.body = { code: 0, payload: [] }
  }
  let gameTypeArr = []
  // 获取全部的游戏大类
  if (inparam.companyIden == '-1') {
    gameTypeArr = Object.values(GameTypeEnum)
  }
  // 获取指定商户的游戏大类 
  else {
    if (inparam.userId) {
      let userRet = await new UserModel().queryUserById(inparam.parent, { ProjectionExpression: "gameList" })
      for (let item of userRet.gameList) {
        gameTypeArr.push(GameTypeEnum[item.code])
      }
    } else {
      gameTypeArr = GameListEnum[inparam.companyIden]
    }
  }
  // 结果返回
  ctx.body = { code: 0, payload: gameTypeArr }
})

module.exports = router