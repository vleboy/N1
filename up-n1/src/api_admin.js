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
const AdminModel = require('./model/AdminModel')
const BillModel = require('./model/BillModel')
const UserCheck = require('./biz/UserCheck')
const { RegisterAdmin, UpdateAdmin, RegisterUser, LoginUser } = require('./biz/auth')
const { RoleCodeEnum, StatusEnum } = require('./lib/UserConsts')
const { Model } = require('./lib/Model')
const { BizErr } = require('./lib/Codes')

// 创建管理员帐号
router.post('/admins', async function (ctx, next) {
    let userInfo = ctx.request.body
    //检查参数是否合法
    new UserCheck().checkAdmin(userInfo)
    // 获取用户IP
    userInfo.lastIP = ctx.request.ip || '-100'
    const adminUser = await RegisterAdmin(userInfo)
    // 操作日志记录
    userInfo.operateAction = '创建管理员帐号'
    userInfo.operateToken = ctx.tokenVerify
    new LogModel().addOperate(userInfo, null, adminUser)
    // 结果返回
    ctx.body = { code: 0, payload: adminUser }
})

// 更新管理员帐号(应用于修改角色)
router.post('/adminUpdate', async function (ctx, next) {
    let userInfo = ctx.request.body
    // 获取用户IP
    userInfo.lastIP = ctx.request.ip || '-100'
    const adminUser = await UpdateAdmin(userInfo)
    // 操作日志记录
    userInfo.operateAction = '更新管理员帐号'
    userInfo.operateToken = ctx.tokenVerify
    new LogModel().addOperate(userInfo, null, adminUser)
    // 结果返回
    ctx.body = { code: 0, payload: adminUser }
})

// 用户注册
router.post('/users', async function (ctx, next) {
    let userInfo = ctx.request.body
    let token = ctx.tokenVerify
    //检查参数是否合法
    new UserCheck().checkUser(userInfo)
    // 获取用户IP
    userInfo.lastIP = ctx.request.ip || '-100'
    const resgisterUserRet = await RegisterUser(token, userInfo)
    // 操作日志记录
    userInfo.operateAction = '创建用户'
    userInfo.operateToken = token
    new LogModel().addOperate(userInfo, null, resgisterUserRet)
    // 结果返回
    ctx.body = { code: 0, payload: resgisterUserRet }
})

// 用户登录
router.post('/users/auth', async function (ctx, next) {
    let userLoginInfo = ctx.request.body
    //检查参数是否合法
    new UserCheck().checkLogin(userLoginInfo)
    // 获取用户IP
    userLoginInfo.lastIP = ctx.request.ip || '-100'
    const loginUserRet = await LoginUser(userLoginInfo)
    // 登录日志
    new LogModel().addLogin(userLoginInfo, null, loginUserRet)
    // 结果返回
    ctx.body = { code: 0, payload: loginUserRet }
})
/**为包站系统定制使用帐号查询 */
router.post('/userChangeStatus', async function (ctx, next) {
    let inparam = ctx.request.body
    if (inparam.userAccount) {
        let userRet = await new UserModel().getUserByName(RoleCodeEnum.Merchant, inparam.userAccount)
        inparam.userId = userRet.userId
        inparam.role = RoleCodeEnum.Merchant
    }
    return next()
})
//变更用户状态
router.post('/userChangeStatus', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new UserCheck().checkStatus(inparam)
    // 查询用户
    let userRet = await new UserModel().getItem({
        ProjectionExpression: 'userId,levelIndex,companyList,#status,username',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        Key: {
            'role': inparam.role,
            'userId': inparam.userId
        }
    })
    let user = userRet.Item
    // 平台用户只能平台管理员/父辈操作
    if (!Model.isPlatformAdmin(token) && !Model.isSubChild(token, user)) {
        throw BizErr.TokenErr('平台用户只能平台管理员/上级操作')
    }
    // 更新用户状态
    if (!inparam.companyList && (inparam.status == StatusEnum.Enable || inparam.status == StatusEnum.Disable)) {
        user.status = inparam.status
    }
    // 更新用户拥有的游戏状态
    if (inparam.companyList) {
        inparam.companyList = companyDifference(user.companyList, inparam.companyList)
        for (let item of inparam.companyList) {
            if (!isNotANumber(item.topAmount) || !(item.status != 0 || item.status != 1)) {
                throw { "code": -1, "msg": "设置公司游戏数据不正确,请检查topAmount或者status", "params": ["companyList"] }
            }
        }
        let newCompanyList = []
        for (let item of inparam.companyList) {
            for (olditem of user.companyList) {
                if (item.company == olditem.company) {
                    newCompanyList.push({ ...item, winloseAmount: olditem.winloseAmount })
                }
            }
        }
        user.companyList = newCompanyList
    }
    // 开始更新用户
    const ret = await new UserModel().changeStatus(inparam.role, inparam.userId, user.status, user.companyList)
    // 操作日志记录
    inparam.operateAction = '变更用户状态'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)

    // 如果是更新用户状态，还要进一步更新所有子用户状态
    if (!inparam.companyList && (inparam.status == StatusEnum.Enable || inparam.status == StatusEnum.Disable)) {
        const merchantUids = [user.userId]  // 需要推送状态变更的用户
        const allChildRet = await new UserModel().listAllChildUsers(user)
        for (let child of allChildRet) {
            new UserModel().changeStatus(child.role, child.userId, inparam.status)
            merchantUids.push(child.userId) // 需要推送状态变更的用户
        }
    }
    // 如果是停用用户游戏
    if (inparam.switch == StatusEnum.Disable) {
        const merchantUids = [user.userId]  // 需要推送状态变更的用户
        // 线路商需要把自己的商户对应游戏也停用
        if (inparam.role == RoleCodeEnum.Manager) {
            const allChildRet = await new UserModel().listChildUsers({ userId: user.userId, role: RoleCodeEnum.Merchant })
            for (let child of allChildRet) {
                if (!_.isEmpty(child.companyList)) {
                    for (let companyItem of child.companyList) {    //匹配出需要停用的下级用户的对应游戏
                        for (let parentCompanyItem of user.companyList) {
                            if (companyItem.company == parentCompanyItem.company && parentCompanyItem.status == 0) {
                                companyItem.status = 0
                            }
                        }
                    }
                    new UserModel().changeStatus(child.role, child.userId, child.status, child.companyList) // 变更商户游戏状态
                    merchantUids.push(child.userId) // 需要推送状态变更的用户
                }
            }
        }
        token.detail = '手动停用'
        token.userId = user.userId
        token.userName = user.username
        token.changeUser = user.username
        new LogModel().add('7', inparam, token)
    } else if (inparam.switch == StatusEnum.Enable) {
        if (inparam.companyList) {
            token.detail = '手动启用'
            token.userId = user.userId
            token.userName = user.username
            token.changeUser = user.username
            new LogModel().add('7', inparam, token)
        }
    }
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 检查参数是否被占用
router.post('/checkExist', async function (ctx, next) {
    let inparam = ctx.request.body
    let retBool = false
    if (inparam.suffix && inparam.nick && inparam.sn) {
        let errArr = []
        let suffixBool = await new UserModel().checkUserBySuffix(inparam.suffix.role, inparam.suffix.suffix, null)
        if (!suffixBool) {
            errArr.push({ suffix: inparam.suffix.suffix, error: `前缀【${inparam.suffix.suffix}】已存在` })
        }
        let nickBool = await new UserModel().checkNickExist(inparam.nick.role, inparam.nick.displayName)
        if (!nickBool) {
            errArr.push({ displayName: inparam.nick.displayName, error: `昵称【${inparam.nick.displayName}】已经存在` })
        }
        let snBool = await new UserModel().checkUserSn(inparam.sn.sn)
        if (!snBool) {
            errArr.push({ sn: inparam.sn.sn, error: `sn【${inparam.sn.sn}】已存在` })
        }
        if (suffixBool && nickBool && snBool) {
            retBool = true
        }
        ctx.body = { code: 0, payload: retBool, msg: errArr }
    } else {
        if (inparam.user) {
            inparam.user.suffix = inparam.user.suffix || Model.StringValue
            if (!inparam.user.role || !inparam.user.suffix || !inparam.user.username) {
                throw BizErr.InparamErr()
            }
            // 业务操作
            retBool = await new UserModel().checkUserBySuffix(inparam.user.role, inparam.user.suffix, inparam.user.username)
        } else if (inparam.suffix) {
            if (!inparam.suffix.role || !inparam.suffix.suffix) {
                throw BizErr.InparamErr()
            }
            // 业务操作
            retBool = await new UserModel().checkUserBySuffix(inparam.suffix.role, inparam.suffix.suffix, null)
        } else if (inparam.nick) {
            if (!inparam.nick.role || !inparam.nick.displayName) {
                throw BizErr.InparamErr()
            }
            // 业务操作
            retBool = await new UserModel().checkNickExist(inparam.nick.role, inparam.nick.displayName)
        } else if (inparam.sn) {
            if (!inparam.sn.sn) {
                throw BizErr.InparamErr()
            }
            // 业务操作
            retBool = await new UserModel().checkUserSn(inparam.sn.sn)
        }
        // 结果返回
        ctx.body = { code: 0, payload: retBool }
    }
})

// 管理员列表
router.post('/adminList', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 业务操作
    let admins = await new AdminModel().page(token, inparam)
    // 查询每个用户余额
    let promiseArr = []
    for (let user of admins) {
        let p = new Promise(async function (resolve, reject) {
            const lastBill = await new BillModel().checkUserLastBill(user)
            user.balance = lastBill.lastBalance
            resolve('Y')
        })
        promiseArr.push(p)
    }
    await Promise.all(promiseArr)
    // 是否需要按照余额排序
    // if (inparam.sortkey && inparam.sortkey == 'balance') {
    admins = _.sortBy(admins, ['subRole', 'balance'])
    // if (inparam.sort == "desc") { admins = admins.reverse() }
    // }
    // 结果返回
    ctx.body = { code: 0, payload: admins }
})

// 管理员个人中心
router.get('/admin_center', async function (ctx, next) {
    let token = ctx.tokenVerify
    // 业务操作
    const admin = await new UserModel().getItem({
        ProjectionExpression: 'userId,username,password,subRole,loginAt,lastIP,points',
        Key: {
            'role': token.role,
            'userId': token.userId
        }
    })
    const lastBill = await new BillModel().checkUserLastBill(admin.Item)
    admin.Item.balance = lastBill.lastBalance
    // 结果返回
    ctx.body = { code: 0, payload: admin.Item }
})

// 更新密码
router.post('/updatePassword', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new UserCheck().checkPassword(inparam)
    // 只有管理员/自己有权限
    if (!Model.isPlatformAdmin(token) && !Model.isSelf(token, inparam)) {
        throw BizErr.TokenErr('只有管理员/自己可以操作')
    }
    // 查询用户
    const user = await new UserModel().queryUserById(inparam.userId)
    // 更新用户密码
    let passhash = Model.hashGen(inparam.password)
    const ret = await new UserModel().updateItem({
        Key: { role: user.role, userId: inparam.userId },
        UpdateExpression: 'SET #password = :password,passhash=:passhash',
        ExpressionAttributeNames: {
            '#password': 'password',
        },
        ExpressionAttributeValues: {
            ':password': inparam.password,
            ':passhash': passhash
        }
    })
    // 操作日志记录
    inparam.operateAction = '修改密码'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 获取下级用户列表
router.get('/childList/:userId/:childRole', async function (ctx, next) {
    let params = ctx.params
    let token = ctx.tokenVerify
    if (!params.childRole || !params.userId) {
        throw BizErr.InparamErr()
    }
    // 只能查看自己下级
    if (parseInt(token.role) > parseInt(params.childRole)) {
        throw BizErr.InparamErr('只能查看下级用户')
    }
    // 业务操作
    const ret = await new UserModel().listChildUsers({ role: params.childRole, userId: params.userId })
    // 查询每个用户余额 
    let promiseArr = []
    for (let user of ret) {
        let p = new Promise(async function (resolve, reject) {
            const lastBill = await new BillModel().checkUserLastBill(user)
            user.balance = lastBill.lastBalance
            resolve('Y')
        })
        promiseArr.push(p)
    }
    await Promise.all(promiseArr)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

/**内部方法 */
//检验是否是数字
function isNotANumber(inputData) {
    //isNaN(inputData)不能判断空串或一个空格 
    //如果是一个空串或是一个空格，而isNaN是做为数字0进行处理的，而parseInt与parseFloat是返回一个错误消息，这个isNaN检查不严密而导致的。 
    if (parseFloat(inputData).toString() == 'NaN') {
        return false;
    } else {
        return true;
    }
}
//比较游戏运营商是否有不一样
function companyDifference(userBefore, userAfter) {
    let arr = []
    // 修改前所有的游戏运营商
    for (let i of userBefore) {
        let isFind = false
        // 需要修改的游戏运营商
        for (let j of userAfter) {
            if (i.company == j.company) {
                i.topAmount = j.topAmount
                i.company = j.company
                i.status = j.status
                arr.push(i)
                isFind = true
                break
            }
        }
        if (!isFind) {
            arr.push(i)
        }
    }
    // if (_.difference(companyBefore, companyAfter).length == 0) {
    //     return true
    // }
    return arr
}

module.exports = router