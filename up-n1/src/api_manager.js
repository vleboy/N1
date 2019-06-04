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
const ManagerModel = require('./model/ManagerModel')
const UserModel = require('./model/UserModel')
const LogModel = require('./model/LogModel')
const BillModel = require('./model/BillModel')
const UserCheck = require('./biz/UserCheck')
const RoleCodeEnum = require('./lib/UserConsts').RoleCodeEnum
const RoleEditProps = require('./lib/UserConsts').RoleEditProps
const Model = require('./lib/Model').Model
const BizErr = require('./lib/Codes').BizErr
const CompanyEnum = require('./lib/Consts').CompanyEnum
/**
 * 线路商列表
 */
router.post('/managers', async function (ctx, next) {
  let inparam = ctx.request.body
  let token = ctx.tokenVerify
  // 只有管理员/线路商有权限
  if (!Model.isPlatformAdmin(token) && !Model.isManager(token)) {
    throw BizErr.TokenErr('只有管理员/线路商有权限')
  }
  // 列表页搜索和排序查询
  let ret = await new ManagerModel().page(token, inparam)
  // 是否只显示h5商户
  if (inparam.isH5) {
    ret = _.filter(ret, function (o) {
      let index = _.findIndex(o.gameList, function (m) { return (m.code == '70000' || m.code == '80000' || m.code == '90000') })
      return index != -1 ? true : false
    })
  }
  // 查询每个线路商余额和商户数量 
  let promiseArr = []
  for (let user of ret) {
    promiseArr.push(new BillModel().checkUserBalance(user))
    promiseArr.push(new UserModel().count(user.userId))
  }
  let resArr = await Promise.all(promiseArr)
  for (let i = 0; i < ret.length; i++) {
    ret[i].balance = resArr[i * 2]
    ret[i].merchantCount = resArr[i * 2 + 1]
  }
  // 是否需要按照余额排序
  ret = _.sortBy(ret, ['balance'])
  if (inparam.sort == "desc") { ret = ret.reverse() }
  // 结果返回
  ctx.body = { code: 0, payload: ret }
})

/**
 * 获取线路商信息
 */
router.get('/managers/:id', async function (ctx, next) {
  let params = ctx.params
  let token = ctx.tokenVerify
  // 只有管理员/线路商有权限
  if (!Model.isPlatformAdmin(token) && !Model.isManager(token)) {
    return ResErr(cb, BizErr.TokenErr('只有管理员/线路商有权限'))
  }
  //如果传的01 表示获取平台余额
  let parent = params.id
  params.id == Model.DefaultParent ? params.id = token.userId : params.id
  // 业务操作 获取余额
  const options = {
    ProjectionExpression: '#role,userId,createdAt,displayName,lastIP,#level,loginAt,#parent,parentName,parentRole,password,#rate,suffix,uname,username,#status,displayId,remark,gameList,parentDisplayName,parentSuffix,winloseAmountMap,companyList,sn,apiKey,loginWhiteList,signatureUrl,subRole,chip,isTest,points',
    ExpressionAttributeNames: { '#role': 'role', '#level': 'level', '#parent': 'parent', '#rate': 'rate', '#status': 'status' }
  }
  const manager = await new UserModel().queryUserById(params.id, options)
  manager.balance = await new BillModel().checkUserBalance(manager)
  let gameTypeArr = []
  // 管理员或上级是管理员，则获取全部游戏类别
  if (parent == RoleCodeEnum.PlatformAdmin || parent == '01') {
    gameTypeArr = CompanyEnum
  } else {
    let newGameList = []
    for (let item of manager.gameList || []) {
      newGameList.push({ company: item.company })
    }
    for (let item of _.uniqWith(newGameList, _.isEqual)) {
      for (let company of CompanyEnum) {
        if (item.company == company.company) {
          gameTypeArr.push({ company: item.company, companyName: company.companyName })
        }
      }
    }
  }
  manager.companyArr = gameTypeArr
  // 结果返回
  ctx.body = { code: 0, payload: manager }
})

/**
 * 更新线路商信息
 */
router.post('/managers/:id', async function (ctx, next) {
  let params = ctx.params
  let token = ctx.tokenVerify
  let managerInfo = ctx.request.body
  //检查参数是否合法
  new UserCheck().checkUserUpdate(managerInfo)
  // 只有管理员/线路商有权限
  if (!Model.isPlatformAdmin(token) && !Model.isManager(token)) {
    throw BizErr.TokenErr('只有管理员/线路商有权限')
  }
  // 业务操作
  const manager = await new UserModel().getUser(params.id, RoleCodeEnum.Manager)
  // 获取更新属性和新密码HASH
  const Manager = { ...manager, ..._.pick(managerInfo, RoleEditProps[RoleCodeEnum.Manager]) }
  Manager.passhash = Model.hashGen(Manager.password)
  //如果isTest发生了变化也要更新所有下级的isTest
  if (manager.isTest != managerInfo.isTest) {
    if (managerInfo.isTest == 0) {
      //测变正，就判断上级必须为正
      let parentInfo = await new UserModel().query({
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId=:userId',
        ProjectionExpression: 'isTest',
        ExpressionAttributeValues: {
          ':userId': manager.parent
        }
      })
      let parentTest = 0
      if (parentInfo.Items.length > 0) {
        parentTest = parentInfo.Items[0].isTest || 0
      }
      if (parentTest != 0) {
        throw { code: -1, msg: "不能变为正式用户，该用户上级为测试用户" }
      }
    } else if (managerInfo.isTest == 1) {
      //正变测，就判断下级不能为正
      let subInfo = await new UserModel().scan({
        ProjectionExpression: 'isTest',
        FilterExpression: "#parent=:parent",
        ExpressionAttributeNames: {
          '#parent': 'parent'
        },
        ExpressionAttributeValues: {
          ':parent': manager.userId
        }
      })
      let subTestArr = []
      for (let item of subInfo.Items) {
        subTestArr.push(item.isTest || 0)
      }
      if (_.indexOf(subTestArr, 0) != -1) {
        throw { code: -1, msg: "不能变为测式用户，该用户下级存在正式用户" }
      }
    }
    Manager.isTest = managerInfo.isTest
  }
  const updateRet = await new UserModel().userUpdate(Manager)
  // 判断是否变更了游戏或者抽成比
  let [gameListDifference, rateBool, differenceList] = getGameListDifference(manager, managerInfo)
  let isChangeGameList = gameListDifference.length != 0 || rateBool ? true : false
  // 判断是否更新所有子用户的游戏或者抽成比
  if (isChangeGameList) {
    let detail = '更新线路商的'
    for (let item of differenceList) {
      detail += `【${item.name}的抽成比为${item.rate}】 `
    }
    params.operateAction = detail
    // let inparam = {
    //   gameListAfter: manager.gameList,
    //   gameListBefore: managerInfo.gameList,
    //   userId: manager.userId,
    //   userName: manager.username,
    //   operateName: token.username
    // }
    // new LogModel().add('8', { gameList: managerInfo.gameList, userId: manager.userId }, inparam)
  } else {
    params.operateAction = '更新线路商基本信息'
  }
  await relatedChange(isChangeGameList, gameListDifference, Manager)
  // 操作日志记录
  params.operateToken = token
  new LogModel().addOperate(params, null, updateRet)
  // 结果返回
  ctx.body = { code: 0, payload: updateRet }
})


/**
 * 可用线路商
 */
router.get('/avalible_managers', async function (ctx, next) {
  let token = ctx.tokenVerify
  // 只有管理员有权限
  if (!Model.isPlatformAdmin(token)) {
    throw BizErr.TokenErr('只有管理员有权限')
  }
  // 业务操作
  const ret = await new UserModel().listAvalibleManagers()
  ret.unshift({ value: '01', label: '直属' })
  // 结果返回
  ctx.body = { code: 0, payload: ret }
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
    for (let k of userAfter.gameList) {
      if (i.code == k.code && i.rate != k.rate) {
        rateBool = true
        differenceList.push(k)
      }
    }
  }
  for (let j of userAfter.gameList) {
    gameListAfter.push(j.code)
  }
  let filterArr = _.difference(gameListBefore, gameListAfter)
  return [filterArr, rateBool, differenceList]
}
/**
 * 变更子用户的游戏等
 * @param {*} isChangeGameList 
 * @param {*} gameListDifference 
 * @param {*} user 
 */
async function relatedChange(isChangeGameList, gameListDifference, user) {
  if (isChangeGameList) {
    const allChildRet = await new UserModel().listAllChildUsers(user)
    for (let child of allChildRet) {
      let isNeedUpdate = false
      // 如果减少游戏，则同步子用户游戏
      if (isChangeGameList) {
        let subGameList = []
        for (let item of child.gameList) {
          if (_.indexOf(gameListDifference, item.code) == -1) {
            subGameList.push(item)
          }
        }
        //修改子用户抽成比在父级抽成比之内
        for (let gameItem of user.gameList) {
          for (let subItem of subGameList) {
            if (subItem.code == gameItem.code) {
              if (+subItem.rate > +gameItem.rate) {
                subItem.rate = gameItem.rate
              }
            }
          }
        }
        child.gameList = subGameList
        isNeedUpdate = true
      }
      // 如果需要，则同步更新子用户
      if (isNeedUpdate) {
        new UserModel().updateItem({
          Key: { role: child.role, userId: child.userId },
          UpdateExpression: 'SET gameList = :gameList',
          ExpressionAttributeValues: {
            ':gameList': child.gameList
          }
        })
      }
    }
  }
}

module.exports = router