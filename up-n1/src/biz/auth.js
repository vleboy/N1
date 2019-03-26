const _ = require('lodash')
const SubRoleModel = require('../model/SubRoleModel')
const BillModel = require('../model/BillModel')
const MsnModel = require('../model/MsnModel')
const UserModel = require('../model/UserModel')
const BaseModel = require('../model/BaseModel')
const GlobalConfig = require("../util/config")
const BizErr = require('../lib/Codes').BizErr
const Model = require('../lib/Model').Model
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const StatusEnum = require('../lib/UserConsts').StatusEnum
const RoleModels = require('../lib/UserConsts').RoleModels
const RoleDisplay = require('../lib/UserConsts').RoleDisplay
const GameTypeEnum = require('../lib/Consts').GameTypeEnum
const CaptchaModel = require('../model/CaptchaModel')

/**
 * 管理员注册
 * @param {*} userInfo 输入用户信息
 */
const RegisterAdmin = async (userInfo) => {
  // 默认值设置
  const adminRole = RoleModels[RoleCodeEnum.PlatformAdmin]()
  const userInput = _.pick({
    ...adminRole,
    ..._.omit(userInfo, ['userId', 'points', 'role', 'suffix', 'passhash']) // 这几个都是默认值
  }, _.keys(adminRole))
  const CheckUser = { ...userInput, passhash: Model.hashGen(userInput.password) }
  // 查询用户是否已存在
  const queryUserRet = await new UserModel().checkUserBySuffix(CheckUser.role, CheckUser.suffix, CheckUser.username)
  if (!queryUserRet) {
    throw BizErr.UserExistErr()
  }
  // 保存用户，处理用户名前缀
  const User = { ...CheckUser, uname: `${CheckUser.username}`, username: `${CheckUser.suffix}_${CheckUser.username}`, rate: 100.00 }
  const saveUserRet = await saveUser(User)
  return saveUserRet
}

/**
 * 更新管理员
 * @param {*} inparam 输入用户信息
 */
const UpdateAdmin = async (inparam) => {
  // 获取管理员
  let queryUserRet = await new UserModel().queryUserById(inparam.userId)
  queryUserRet.subRole = inparam.subRole
  // 保存更新用户
  const saveUserRet = await saveUser(queryUserRet)
  return saveUserRet
}

/**
 * 建站商/商户注册
 * @param {*} token 身份令牌
 * @param {*} userInfo 输入用户信息
 */
const RegisterUser = async (token = {}, userInfo = {}) => {
  // 生成注册用户信息
  const bizRole = RoleModels[userInfo.role]()
  userInfo = _.omit(userInfo, ['userId', 'passhash'])
  const userInput = _.pick({ ...bizRole, ...userInfo }, _.keys(bizRole))
  const CheckUser = { ...userInput, passhash: Model.hashGen(userInput.password) }

  // 检查用户是否已经存在
  const queryUserRet = await new UserModel().checkUserBySuffix(CheckUser.role, CheckUser.suffix, CheckUser.username)
  if (!queryUserRet) {
    throw BizErr.UserExistErr()
  }
  // 检查昵称是否已经存在
  const queryNickRet = await new UserModel().checkNickExist(CheckUser.role, CheckUser.displayName)

  if (!queryNickRet) {
    throw BizErr.NickExistErr()
  }
  // 检查sn是否已经存在
  if (CheckUser.sn) {
    const queryRetsn = await new UserModel().checkUserSn(CheckUser.sn)
    if (!queryRetsn) {
      throw BizErr.UserExistSn()
    }
  }
  // 如果是创建商户，自动生成msn
  if (CheckUser.role === RoleCodeEnum.Merchant) {
    let msnRet = await new MsnModel().getAllMsn()
    // 所有线路号都被占用
    if (msnRet.Items.length >= 999) {
      throw BizErr.MsnFullError()
    } else {
      // 所有占用线路号组成数组
      let msnArr = []
      for (let item of msnRet.Items) {
        msnArr.push(parseInt(item.msn))
      }
      // 随机生成线路号
      let randomMsn = randomNum(1, 999)
      // 判断随机线路号是否已被占用
      while (msnArr.indexOf(randomMsn) != -1) {
        randomMsn = randomNum(1, 999)
      }
      CheckUser.msn = randomMsn.toString()
    }
  }

  // 如果parent未指定,则为管理员. 从当前管理员对点数中扣去点数进行充值. 点数不可以为负数.而且一定是管理员存点到新用户
  const parentUser = await queryParent(token, CheckUser.parent)
  // 校验游戏是否正确，占成是否正确
  checkGameList(CheckUser, parentUser)
  // 检查下级成数
  // if (parentUser.level != 0 && (CheckUser.rate > parentUser.rate)) {
  //   return [BizErr.InparamErr('成数比不能高于上级'), 0]
  // }

  // 如果是线路商创建商户，检查可用余额
  // if (parentUser.role === RoleCodeEnum.Manager && CheckUser.role === RoleCodeEnum.Merchant) {
  //   // 查询已用商户已用数量
  //   let merchantUsedCount = 0
  //   const [err, ret] = await new UserModel().listChildUsers(parentUser, RoleCodeEnum.Merchant)
  //   if (ret && ret.length > 0) {
  //     merchantUsedCount = ret.length
  //   }
  //   if (merchantUsedCount >= parentUser.limit) {
  //     return [BizErr.InparamErr('商户可用名额不足'), 0]
  //   }
  // }

  // 初始点数
  const initPoints = CheckUser.points
  // 检查余额
  const lastBill = await new BillModel().checkUserLastBill(parentUser)

  if (initPoints > lastBill.lastBalance) {
    throw BizErr.BalanceErr()
  }
  // 层级处理
  let levelIndex = Model.DefaultParent
  if (parentUser.levelIndex && parentUser.levelIndex != '0' && parentUser.levelIndex != 0) {
    levelIndex = parentUser.levelIndex + ',' + parentUser.userId
  }
  let isTest = parentUser.isTest ? parentUser.isTest : 0
  // 保存用户，处理用户名前缀
  const User = {
    ...CheckUser,
    uname: `${CheckUser.username}`,
    username: `${CheckUser.suffix}_${CheckUser.username}`,
    parentName: parentUser.username,
    parentRole: parentUser.role,
    parentDisplayName: parentUser.displayName,
    parentSuffix: parentUser.suffix,
    points: Model.NumberValue,
    level: parentUser.level + 1,
    levelIndex: levelIndex,
    isTest: isTest
  }
  const saveUserRet = await saveUser(User)
  // 开始转账
  parentUser.operatorToken = token
  const depositRet = await new BillModel().billTransfer(parentUser, {
    toUser: saveUserRet.username,
    toRole: saveUserRet.role,
    toLevel: saveUserRet.level,
    toDisplayName: saveUserRet.displayName,
    toUserId: saveUserRet.userId,
    amount: initPoints,
    operator: token.username,
    remark: '初始点数'
  })
  var orderId = depositRet.sn || '-1'
  return { ...saveUserRet, orderId: orderId }
}

/**
 * 用户登录
 * @param {*} userLoginInfo 用户登录信息
 */
const LoginUser = async (userLoginInfo = {}) => {
  // 检查验证码
  if (!userLoginInfo.mobileFlag) { //如果有flag标识 代表是移动端 不校验验证码
    // 检查验证码
    await new CaptchaModel().check(userLoginInfo)
    // if (!userLoginInfo.vid || !userLoginInfo.challenge) {
    //   throw BizErr.CaptchaErr('验证码错误')
    // }
  }
  // 获取用户身份
  const Role = RoleModels[userLoginInfo.role]()
  // 组装用户登录信息
  const LoginInfo = _.pick({ ...Role, ...userLoginInfo }, _.keys(Role))
  // 查询用户信息
  const queryUserRet = await new UserModel().queryUserByNameOrSn(LoginInfo.role, LoginInfo.suffix, LoginInfo.username, LoginInfo.sn)
  if (!queryUserRet || !queryUserRet.Items || queryUserRet.Items.length === 0) {
    throw BizErr.UserNotFoundErr('用户不存在')
  }
  const User = queryUserRet.Items[0]
  // 校验用户密码
  if (!Model.hashValidate(User.password, LoginInfo.password)) {
    throw BizErr.PasswordErr()
  }
  // 检查用户是否被锁定
  if (User.status == StatusEnum.Disable) {
    throw BizErr.UserLockedErr()
  }
  // 更新用户信息
  new UserModel().updateItem({
    Key: { role: User.role, userId: User.userId },
    UpdateExpression: 'SET lastIP = :lastIP,loginAt=:loginAt',
    ExpressionAttributeValues: {
      ':lastIP': LoginInfo.lastIP,
      ':loginAt': Date.now()
    }
  })
  // 平台管理员，获取二级权限
  if (Model.isPlatformAdmin(userLoginInfo)) {
    const subRole = await new SubRoleModel().getOne({ name: User.subRole })
    User.subRolePermission = subRole.permissions
  }
  // 返回用户身份令牌
  let saveUserRet = _.pick(User, RoleDisplay[User.role])
  saveUserRet.subRolePermission = User.subRolePermission
  saveUserRet.lastIP = userLoginInfo.lastIP
  let minitoken = {
    userId: saveUserRet.userId,
    role: saveUserRet.role,
    suffix: saveUserRet.suffix,
    username: saveUserRet.username,
    parent: saveUserRet.parent,
    parentName: saveUserRet.parentName,
    parentDisplayName: saveUserRet.parentDisplayName,
    parentRole: saveUserRet.parentRole,
    displayName: saveUserRet.displayName,
    level: saveUserRet.level,
    msn: saveUserRet.msn,
    displayId: saveUserRet.displayId,
    sn: saveUserRet.sn,
    subRole: saveUserRet.subRole,
    subRolePermission: saveUserRet.subRolePermission
  }
  return { ...saveUserRet, token: Model.token(minitoken) }
}

// ==================== 以下为内部方法 ====================

// 查询用户上级
const queryParent = async (token, parent) => {
  var id = 0
  if (!parent || Model.DefaultParent == parent) {
    id = token.userId
  } else {
    id = parent
  }
  const user = await new UserModel().queryUserById(id)
  return user
}

// 保存用户
const saveUser = async (userInfo) => {
  // 线路商或商户，从编码池获取新编码
  if (RoleCodeEnum.Manager == userInfo.role || RoleCodeEnum.Merchant == userInfo.role) {
    userInfo.displayId = Model.randomNum(6)
    let checkExist = true
    while (checkExist) {
      let res = await new UserModel().query({
        IndexName: 'merchantIdIndex',
        KeyConditionExpression: 'displayId = :displayId',
        ProjectionExpression: 'userId',
        ExpressionAttributeValues: {
          ':displayId': userInfo.displayId
        }
      })
      res.Items.length == 0 ? checkExist = false : userInfo.displayId = Model.randomNum(6)
    }
  }
  // 组装用户信息
  const baseModel = Model.baseModel()
  const UserItem = { ...baseModel, ...userInfo, updatedAt: Date.now(), loginAt: Date.now() }
  // 保存用户
  await new BaseModel().db$('put', { TableName: GlobalConfig.TABLE_NAMES.ZeusPlatformUser, Item: UserItem })
  return _.pick(UserItem, RoleDisplay[userInfo.role])
}


// 随机数
function randomNum(min, max) {
  let range = max - min
  let rand = Math.random()
  let num = min + Math.round(rand * range)
  return num
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

//获取数字加字母的sn
// function getsn(leng = 6) {
//   let numberArr = [0, 2, 3, 4, 5, 6, 7, 8, 9]
//   let letterArr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
//   let indexArr = []
//   for (let i = 1; i < leng; i++) {
//     indexArr.push(i)
//   }
//   let index1 = indexArr[Math.floor(Math.random() * (leng - 1))]
//   let index2 = leng - index1
//   let snArr = []
//   for (let i = 0; i < index1; i++) {
//     snArr.push(numberArr[Math.floor(Math.random() * numberArr.length)])
//   }
//   for (let i = 0; i < index2; i++) {
//     snArr.push(letterArr[Math.floor(Math.random() * letterArr.length)])
//   }
//   let newsnArr = _.shuffle(snArr)
//   let sn = newsnArr.join('')
//   return sn
// }

module.exports = {
  LoginUser,
  RegisterUser,
  UpdateAdmin,
  RegisterAdmin
}