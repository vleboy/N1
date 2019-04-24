// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const UserModel = require('./model/UserModel')
const LogModel = require('./model/LogModel')
const CompanyModel = require('./model/CompanyModel')
const GameModel = require('./model/GameModel')
const GameCheck = require('./biz/GameCheck')
const RoleCodeEnum = require('./lib/Consts').RoleCodeEnum
const GameTypeEnum = require('./lib/Consts').GameTypeEnum

/**
 * 创建游戏
 */
router.post('/games', async function (ctx, next) {
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
router.post('/gameList', async function (ctx, next) {
  let token = ctx.tokenVerify
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
router.get('/gameOne/:gameType/:gameId', async function (ctx, next) {
  let gameParams = ctx.params
  // 业务操作
  const ret = await new GameModel().getOne(gameParams.gameType, gameParams.gameId)
  // ret.gameType = GameTypeEnum[ret.gameType].name
  // 结果返回
  ctx.body = { code: 0, payload: ret }
})

/**
 * 游戏列表（第三方网页游戏使用）
 */
router.get('/gameList/:gameType', async function (ctx, next) {
  let inparam = ctx.params
  const isAll = ctx.query.isAll === true || false
  //检查参数是否合法
  inparam.query = { gameStatus: 1 }  //默认查启用状态
  if (isAll) {  //如果有这个标志，表示全查所有游戏
    delete inparam.query
  }
  new GameCheck().checkQuery(inparam)
  // 普通游戏列表
  let ret = await new GameModel().list(inparam)
  // 结果返回
  ctx.body = { code: 0, payload: ret }
})

// 通过玩家id获取商户的游戏列表(70000/80000/90000)
router.get('/player/gameList/:userId', async function (ctx, next) {
  //1,获取入参
  const userId = ctx.params.userId
  //2.请求
  try {
    let res = await axios.get(`https://${config.env.N1_CENTER}/player/gameList/${userId}`)
    if (res.data.code != -1) {
      let resArr = []
      for (let gameType of res.data) {
        resArr.push(await new GameModel().list({ gameType: gameType.toString(), query: { gameStatus: 1 } }))
      }
      //3.返回结果
      ctx.body = _.flatten(resArr)
    } else {
      ctx.body = { code: res.data.code, msg: res.data.msg }
    }
  } catch (error) {
    console.log(error)
    ctx.body = { code: -1, msg: 'N' }
  }
})

/**
 * 游戏编辑
 */
router.post('/gameUpdate', async function (ctx, next) {
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
router.post('/gameChangeStatus', async function (ctx, next) {
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
router.post('/gameChangeOrder', async function (ctx, next) {
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

/**
 * 游戏类别
 */
router.post('/gameType', async function (ctx, next) {
  let token = ctx.tokenVerify
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
  const ret = await new UserModel().queryUserGameInfo(inparam.parent)
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
router.post('/companySelect', async function (ctx, next) {
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
 * 获取运营商 NA TTG等
 */
router.post('/companySelect', async function (ctx, next) {
  let inparam = ctx.request.body
  let gameTypeArr = []
  const companyRet = await new CompanyModel().scan({
    ProjectionExpression: 'companyIden,companyName'
  })
  // 管理员或上级是管理员，则获取全部游戏类别
  if (!inparam.parent || inparam.parent == RoleCodeEnum.PlatformAdmin || inparam.parent == '01') {
    for (let item of companyRet.Items) {
      gameTypeArr.push({ company: item.companyIden, companyName: item.companyName })
    }
    return ctx.body = { code: 0, payload: gameTypeArr }
  }
  // 否则只查询上级有的游戏
  const userRet = await new UserModel().queryUserGameInfo(inparam.parent)
  let parentGameList = userRet.gameList || []
  // 刷新最新游戏类型内容
  let newGameList = []
  for (let item of parentGameList) {
    newGameList.push({ company: item.company })
  }
  //去重
  newGameList = _.uniqWith(newGameList, _.isEqual)
  for (let item of newGameList) {
    for (let company of companyRet.Items) {
      if (item.company == company.companyIden) {
        gameTypeArr.push({ company: item.company, companyName: company.companyName })
      }
    }
  }
  // 结果返回
  ctx.body = { code: 0, payload: gameTypeArr }
})

// 为包站系统定制使用帐号查询
router.post('/gameBigType', async function (ctx, next) {
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
router.post('/gameBigType', async function (ctx, next) {
  let inparam = ctx.request.body
  if (!inparam.companyIden) {
    return ctx.body = { code: 0, payload: [] }
  }
  // 获取全部的游戏大类
  let gameTypeArr = []
  if (inparam.companyIden == '-1') {
    for (let item in GameTypeEnum) {
      gameTypeArr.push(GameTypeEnum[item])
    }
    return ctx.body = { code: 0, payload: gameTypeArr }
  }
  // 获取指定运营商的游戏大类
  let ret = await new CompanyModel().scan({
    ProjectionExpression: 'gameTypeList',
    FilterExpression: "companyIden=:companyIden",
    ExpressionAttributeValues: {
      ':companyIden': inparam.companyIden
    }
  })
  if (ret.Items && ret.Items.length != 0) {
    let typeArr = ret.Items[0].gameTypeList
    // 没有userId，直接返回
    if (!inparam.userId) {
      for (let item of typeArr) {
        gameTypeArr.push(GameTypeEnum[item])
      }
      return ctx.body = { code: 0, payload: gameTypeArr }
    }
    //如果有userId过滤掉没有的游戏大类
    let userRet = await new UserModel().queryUserGameInfo(inparam.userId)
    let newTypeArr = []
    for (let i = 0; i < userRet.gameList.length; i++) {
      if (_.includes(typeArr, userRet.gameList[i].code)) {
        newTypeArr.push(userRet.gameList[i].code)
      }
    }
    for (let item of newTypeArr) {
      gameTypeArr.push(GameTypeEnum[item])
    }
  }
  // 结果返回
  ctx.body = { code: 0, payload: gameTypeArr }
})



// const BizErr = require('./lib/Codes').BizErr
// const serverKey = "0IiwicGFyZW50IjoiMDAiLCJwYXJlbnROYW1lIjoiU3VwZXJBZG1pbiIsInBhcmVudFJvbGUiOiIwMCIsImRpc3BsYXlOYW1lIjoi5Luj55CG566h55CG5"
// /**
//  * 根据kindId查游戏
//  */
// router.post('/single/game', async function (ctx, next) {
//   let params = ctx.request.body
//   let token = ctx.tokenVerify
//   let game
//   let { key, kindId, gameType } = params
//   if (key != serverKey) {
//     throw BizErr.ParamErr()
//   }
//   if (kindId) {
//     game = await new GameModel().findByKindId(kindId + "")
//   } else {
//     game = await new GameModel().findSingleByType(gameType)
//   }
//   // 结果返回
//   ctx.body = { code: 0, payload: game }
// })

// /**
//  *  获取游戏大类
//  */
// router.post('/externBigType', async function (ctx, next) {
//   let inparam = ctx.request.body
//   if (!inparam.companyIden) {
//     return { code: 0, gameTypeEnum: GameTypeEnum, payload: [] }
//   }
//   // 获取全部的游戏大类
//   let gameTypeArr = []
//   if (inparam.companyIden == '-1') {
//     for (let item in GameTypeEnum) {
//       gameTypeArr.push(GameTypeEnum[item])
//     }
//     return ctx.body = { code: 0, gameTypeEnum: GameTypeEnum, payload: gameTypeArr }
//   }
//   // 获取指定运营商的游戏大类
//   let ret = await new CompanyModel().scan({
//     ProjectionExpression: 'gameTypeList',
//     FilterExpression: "companyIden=:companyIden",
//     ExpressionAttributeValues: {
//       ':companyIden': inparam.companyIden
//     }
//   })
//   let typeArr = ret.Items[0].gameTypeList
//   // 没有userId，直接返回
//   if (!inparam.userId) {
//     for (let item of typeArr) {
//       gameTypeArr.push(GameTypeEnum[item])
//     }
//     return ctx.body = { code: 0, gameTypeEnum: GameTypeEnum, payload: gameTypeArr }
//   } else {
//     return ctx.body = { code: 0, gameTypeEnum: GameTypeEnum, payload: typeArr }
//   }
// })

module.exports = router