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
const LogModel = require('./model/LogModel')
const AgentModel = require('./model/AgentModel')
const UserModel = require('./model/UserModel')
const PlayerModel = require('./model/PlayerModel')
const BillModel = require('./model/BillModel')
const PushModel = require('./model/PushModel')
const AgentCheck = require('./biz/AgentCheck')
const UserCheck = require('./biz/UserCheck')
const RoleCodeEnum = require('./lib/UserConsts').RoleCodeEnum
const StatusEnum = require('./lib/UserConsts').StatusEnum
const RoleEditProps = require('./lib/UserConsts').RoleEditProps
const Model = require('./lib/Model').Model
const BizErr = require('./lib/Codes').BizErr


// 代理管理员注册
router.post('/agentAdminNew', async function (ctx, next) {
    let userInfo = ctx.request.body
    //检查参数是否合法
    new AgentCheck().checkAdmin(userInfo)
    // TODO 获取用户IP
    userInfo.lastIP = ctx.request.ip || '-100'
    const resgisterUserRet = await new AgentModel().registerAdmin(userInfo)
    // 操作日志记录
    userInfo.operateAction = '创建代理管理员'
    userInfo.operateToken = ctx.tokenVerify
    new LogModel().addOperate(userInfo, null, resgisterUserRet)
    ctx.body = { code: 0, payload: resgisterUserRet }
})

// 代理注册
router.post('/agentNew', async function (ctx, next) {
    let userInfo = ctx.request.body
    //检查参数是否合法
    new AgentCheck().check(userInfo)
    // 业务操作
    userInfo.lastIP = ctx.request.ip || '-100'
    const resgisterUserRet = await new AgentModel().register(ctx.tokenVerify, userInfo)
    // 操作日志记录
    userInfo.operateAction = '创建代理'
    userInfo.operateToken = ctx.tokenVerify
    new LogModel().addOperate(userInfo, null, resgisterUserRet)
    // 结果返回
    ctx.body = { code: 0, payload: resgisterUserRet }
})

// 代理登录
router.post('/agentLogin', async function (ctx, next) {
    let userInfo = ctx.request.body
    //检查参数是否合法
    new AgentCheck().checkLogin(userInfo)
    // 用户登录
    userInfo.lastIP = ctx.request.ip || '-100'
    const loginUserRet = await new AgentModel().login(userInfo)
    // 登录日志
    loginUserRet.lastIP = ctx.request.ip || '-100'
    new LogModel().addLogin(userInfo, null, loginUserRet)
    // 结果返回
    ctx.body = { code: 0, payload: loginUserRet }
})

// 单个代理
router.get('/agentOne/:id', async function (ctx, next) {
    let params = ctx.params
    let token = ctx.tokenVerify
    //如果传的01 表示获取平台余额
    let parent = params.id
    params.id == Model.DefaultParent ? params.id = token.userId : params.id
    // 业务操作
    const queryRet = await new UserModel().query({
        KeyConditionExpression: '#userId = :userId and #role = :role',
        ProjectionExpression: 'userId,#role,displayId,displayName,parent,parentName,parentDisplayName,parentRole,sn,username,password,rate,createdAt,loginAt,lastIP,remark,gameList,points,#level,#status,chip,isTest',
        ExpressionAttributeNames: {
            '#userId': 'userId',
            '#role': 'role',
            '#level': 'level',
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':userId': params.id,
            ':role': RoleCodeEnum.Agent
        }
    })
    if (queryRet.Items.length - 1 != 0) {
        throw BizErr.UserNotFoundErr()
    }
    const ret = queryRet.Items[0]
    // 业务操作 获取余额
    const lastBill = await new BillModel().checkUserLastBill(ret)
    ret.balance = lastBill.lastBalance
    ret.playerCount = ret.level == 0 ? null : await new PlayerModel().count(params.id)
    ret.agentCount = ret.level == 0 ? null : await new UserModel().count(params.id)
    // ret.lastBill = lastBill
    //获取对应的游戏大类
    let url = config.env.GAME_CENTER
    if (process.env.NODE_ENV == 'agent-n2') {
        url = config.env.N2_CENTER
    }
    let companyArrRes = await axios.post(`https://${url}/companySelect`, { parent }, { headers: { 'Authorization': ctx.header.authorization } })
    ret.companyArr = companyArrRes.data.payload
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 变更用户状态
router.post('/userChangeStatus', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new UserCheck().checkStatus(inparam)
    // 查询用户
    let userRet = await new UserModel().getItem({
        ProjectionExpression: 'userId,username,levelIndex,companyList,#status',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        Key: {
            'role': inparam.role,
            'userId': inparam.userId
        }
    })
    let user = userRet.Item
    // 代理用户只能代理管理员/父辈操作
    if (Model.isAgent(user) && !Model.isAgentAdmin(token) && !Model.isSubChild(token, user)) {
        throw BizErr.TokenErr('代理用户只能代理管理员/上级操作')
    }
    // 更新用户状态
    if (!inparam.companyList && (inparam.status == StatusEnum.Enable || inparam.status == StatusEnum.Disable)) {
        user.status = inparam.status
    }
    // 更新用户拥有的游戏状态
    if (inparam.companyList) {
        user.companyList = inparam.companyList
    }
    // 开始更新用户
    const ret = await new UserModel().updateItem({
        Key: { role: inparam.role, userId: inparam.userId },
        UpdateExpression: 'SET #status = :status,companyList=:companyList',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
            ':status': user.status,
            ':companyList': user.companyList
        }
    })
    // 操作日志记录
    inparam.operateAction = '变更用户状态'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)

    // 如果是更新用户状态，还要进一步更新所有子用户状态
    if (!inparam.companyList && (inparam.status == StatusEnum.Enable || inparam.status == StatusEnum.Disable)) {
        const merchantUids = [user.userId]  // 需要推送状态变更的用户
        const allChildRet = await new UserModel().listAllChildUsers(user)
        for (let child of allChildRet) {
            new UserModel().updateItem({
                Key: { role: child.role, userId: child.userId },
                UpdateExpression: 'SET #status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':status': inparam.status,
                }
            })
            merchantUids.push(child.userId) // 需要推送状态变更的用户
        }
        // 只有停用才通知大厅服务器，使玩家下线
        if (inparam.status == StatusEnum.Disable) {
            new PushModel().pushForzen({ type: 2, uids: merchantUids, msg: '你已经被锁定，不能再继续游戏!' })
        }
    }
    // 如果是停用用户游戏
    if (inparam.switch == StatusEnum.Disable) {
        const merchantUids = [user.userId]  // 需要推送状态变更的用户
        // const allChildRet = await new UserModel().listAllChildUsers(user)
        // for (let child of allChildRet) {
        //     merchantUids.push(child.userId) // 需要推送状态变更的用户
        // }
        token.detail = '手动停用'
        token.userId = user.userId
        token.userName = user.username
        token.changeUser = user.username
        new LogModel().add('7', inparam, token)
        new PushModel().pushForzen({ type: 2, uids: merchantUids, msg: '请联系运营商' })
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

// 代理更新角色
router.post('/updateSubrole', async function (ctx, next) {
    let userInfo = ctx.request.body
    // 获取用户IP
    userInfo.lastIP = ctx.request.ip || '-100'
    let adminUser = await new UserModel().updateItem({
        Key: {
            'role': RoleCodeEnum.Agent,
            'userId': userInfo.userId
        },
        UpdateExpression: "SET subRole = :subRole",
        ExpressionAttributeValues: {
            ':subRole': userInfo.subRole
        }
    })
    // 操作日志记录
    userInfo.operateAction = '更新代理角色'
    userInfo.operateToken = ctx.tokenVerify
    new LogModel().addOperate(userInfo, null, adminUser)
    // 结果返回
    ctx.body = { code: 0, payload: adminUser }
})

// 代理更新限红
router.post('/updateChip', async function (ctx, next) {
    let inparam = ctx.request.body
    //检查参数是否合法
    new AgentCheck().checkChip(inparam)
    // 业务操作
    const updateRet = await new UserModel().updateItem({
        Key: { role: RoleCodeEnum.Agent, userId: inparam.userId },
        UpdateExpression: 'SET chip = :chip',
        ExpressionAttributeValues: {
            ':chip': inparam.chip
        }
    })
    // 操作日志记录
    inparam.operateAction = '更新代理的限红'
    inparam.operateToken = ctx.tokenVerify
    new LogModel().addOperate(inparam, null, updateRet)
    // 结果返回
    ctx.body = { code: 0, payload: updateRet }
})


// 代理更新
router.post('/agentUpdate', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //检查参数是否合法
    new AgentCheck().checkUpdate(inparam)
    // 业务操作
    const ret = await new UserModel().getUser(inparam.userId, RoleCodeEnum.Agent)
    // 获取更新属性和新密码HASH
    const Agent = { ...ret, ..._.pick(inparam, RoleEditProps[RoleCodeEnum.Agent]) }
    Agent.passhash = Model.hashGen(Agent.password)
    //如果isTest发生了变化也要更新下级
    if (ret.isTest != inparam.isTest) {
        if (inparam.isTest == 0) {
            //测变正，就判断上级必须为正
            let parentInfo = await new UserModel().query({
                IndexName: 'UserIdIndex',
                KeyConditionExpression: 'userId=:userId',
                ProjectionExpression: 'isTest',
                ExpressionAttributeValues: {
                    ':userId': ret.parent
                }
            })
            let parentTest = 0
            if (parentInfo.Items.length > 0) {
                parentTest = parentInfo.Items[0].isTest || 0
            }
            if (parentTest != 0) {
                throw { code: -1, msg: "不能变为正式用户，该用户上级为测试用户" }
            }
        } else if (inparam.isTest == 1) {
            //正变测，就判断下级不能为正
            let subInfo = await new UserModel().query({
                IndexName: 'RoleParentIndex',
                KeyConditionExpression: '#role = :role AND #parent=:parent',
                ProjectionExpression: 'isTest',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#parent': 'parent'
                },
                ExpressionAttributeValues: {
                    ':parent': ret.userId,
                    ':role': '1000'
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
        Agent.isTest = inparam.isTest
    }
    const updateRet = await new UserModel().userUpdate(Agent)
    // 判断是否变更了游戏或者抽成比
    let [gameListDifference, mixBool] = getGameListDifference(ret, inparam)
    let isChangeGameList = gameListDifference.length != 0 || mixBool ? true : false
    let isChangeRate = ret.rate != inparam.rate ? true : false
    if (isChangeGameList) {
        let loginparam = {
            gameListAfter: ret.gameList,
            gameListBefore: inparam.gameList,
            userId: inparam.userId,
            userName: inparam.username,
            operateName: token.username
        }
        new LogModel().add('8', { gameList: inparam.gameList, userId: inparam.userId }, loginparam)
    }
    // 判断是否更新所有子用户的游戏或者抽成比
    await relatedChange(isChangeGameList, isChangeRate, gameListDifference, Agent)
    // 操作日志记录
    inparam.operateAction = '更新代理信息'
    inparam.operateToken = ctx.tokenVerify
    new LogModel().addOperate(inparam, null, updateRet)
    // 结果返回
    ctx.body = { code: 0, payload: updateRet }
})

// 重置代理密码
router.post('/updateAgentPassword', async function (ctx, next) {
    let inparam = ctx.request.body
    // 检查参数是否合法
    new AgentCheck().checkPassword(inparam)
    // 查询用户
    const user = await new UserModel().queryUserById(inparam.userId)
    // 更新用户密码
    const ret = await new UserModel().updateItem({
        Key: { role: user.role, userId: inparam.userId },
        UpdateExpression: 'SET #password = :password,passhash=:passhash',
        ExpressionAttributeNames: {
            '#password': 'password',
        },
        ExpressionAttributeValues: {
            ':password': inparam.password,
            ':passhash': Model.hashGen(user.password)
        }
    })
    // 操作日志记录
    inparam.operateAction = '修改密码'
    inparam.operateToken = ctx.tokenVerify
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 检查洗码比是否在上级的范围内
router.post('/checkAgentMix', async function (ctx, next) {
    let inparam = ctx.request.body
    // 查询用户
    const user = await new UserModel().queryUserById(inparam.userId)
    let mix = 0
    if (user.levelIndex == '0') {
        mix = 1
    } else {
        for (let i = 0; i < user.gameList.length; i++) {
            if (user.gameList[i].code == inparam.code) {
                mix = user.gameList[i].mix
                break
            }
        }
    }
    // 结果返回
    ctx.body = { code: 0, payload: { mix } }
})

// 检查参数是否被占用
router.post('/checkExist', async function (ctx, next) {
    let inparam = ctx.request.body
    let retBool = false
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
})

// 代理管理员列表
router.post('/agentAdminList', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    let admins = await new AgentModel().adminPage(ctx.tokenVerify, inparam)
    // 查询每个用户余额
    let promiseArr = []
    for (let user of admins) {
        let p = new Promise(async function (resolve, reject) {
            const lastBill = await new BillModel().checkUserLastBill(user)
            user.balance = lastBill.lastBalance
            // user.lastBill = lastBill
            resolve('Y')
        })
        promiseArr.push(p)
    }
    await Promise.all(promiseArr)
    // 是否需要按照余额排序
    if (inparam.sortkey && inparam.sortkey == 'balance') {
        admins = _.sortBy(admins, [inparam.sortkey])
        if (inparam.sort == "desc") { admins = admins.reverse() }
    }
    // 结果返回
    ctx.body = { code: 0, payload: admins }
})

// 可用代理列表
router.post('/availableAgents', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    const ret = await new UserModel().listAvailableAgents(ctx.tokenVerify, inparam)
    ctx.body = { code: 0, payload: ret }
})

// 代理列表
router.post('/agentList', async function (ctx, next) {
    let inparam = ctx.request.body
    inparam.token = ctx.tokenVerify
    new AgentCheck().checkQueryList(inparam)
    if (inparam.parent == Model.DefaultParent && !Model.isAgentAdmin(inparam.token)) {
        throw BizErr.RoleTokenErr()
    }
    // 业务操作
    let ret = await new AgentModel().page(ctx.tokenVerify, inparam)
    // 查询每个用户余额
    let promiseArr = []
    for (let user of ret) {
        let p = new Promise(async function (resolve, reject) {
            const lastBill = await new BillModel().checkUserLastBill(user)
            user.balance = lastBill.lastBalance
            user.playerCount = await new PlayerModel().count(user.userId)
            user.agentCount = await new UserModel().count(user.userId)
            // user.lastBill = lastBill
            resolve('Y')
        })
        promiseArr.push(p)
    }
    await Promise.all(promiseArr)
    // 是否需要按照余额排序
    // if (inparam.sortkey && inparam.sortkey == 'balance') {
    ret = _.sortBy(ret, ['balance'])
    //增加h5过滤
    if (inparam.isH5) {
        ret = _.filter(ret, function (o) {
            let index = _.findIndex(o.gameList, function (m) { return (m.code == '70000' || m.code == '80000' || m.code == '90000') })
            return index != -1 ? true : false
        })
    }
    if (inparam.sort == "desc") { ret = ret.reverse() }
    // }
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 获取sn
router.get('/getSnInfo/:sn', async function (ctx, next) {
    let inparam = ctx.params
    if (!inparam.sn) {
        throw BizErr.InparamErr()
    }
    // 检查参数是否合法
    const [checkAttError, errorParams] = new UserCheck().checkSn(inparam.sn)
    if (checkAttError) {//数据不合法返回结果
        throw { 'state': 1 }
    }
    // 业务操作
    let [err, admins] = await new UserModel().getSnInfo(inparam)
    if (admins.role == '1000') {//为代理默认线路号
        admins.msn = '000'
    }

    // 结果返回
    if (admins.launchImg && admins.launchImg != "NULL!") {
        if (admins.launchImg.logo[0].indexOf('NAlogo.png') != -1) {
            delete admins.launchImg
        }
        // admins.launchImg = {
        //     logo: ['https://s3-ap-southeast-1.amazonaws.com/image-na-dev/NAlogo.png', 'http://assetdownload.oss-cn-hangzhou.aliyuncs.com/image/NAlogo.png'],
        //     name: ['https://s3-ap-southeast-1.amazonaws.com/image-na-dev/dating-nagaming.png', 'http://assetdownload.oss-cn-hangzhou.aliyuncs.com/image/dating-nagaming.png']
        // }
    } else if (admins.launchImg == "NULL!") {
        delete admins.launchImg
    }
    // 结果返回
    ctx.body = { code: 0, 'userName': admins.username, 'moneyURL': admins.moneyURL, 'registerURL': admins.registerURL, 'feedbackURL': admins.feedbackURL, 'msn': admins.msn, 'state': 0, img: admins.launchImg }
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
    let mixBool = false
    for (let i of userBefore.gameList) {
        gameListBefore.push(i.code)
        for (let k of userAfter.gameList) {
            if (i.code == k.code && i.mix != k.mix) {
                mixBool = true
            }
        }
    }
    for (let j of userAfter.gameList) {
        gameListAfter.push(j.code)
    }
    let filterArr = _.difference(gameListBefore, gameListAfter)
    return [filterArr, mixBool]
}
/**
 * 变更子用户的游戏和抽成比等
 * @param {*} isChangeGameList 
 * @param {*} isChangeRate 
 * @param {*} gameListDifference 
 * @param {*} user 
 */
async function relatedChange(isChangeGameList, isChangeRate, gameListDifference, user) {
    if (isChangeGameList || isChangeRate) {
        const allChildRet = await new UserModel().listAllChildUsers(user)
        for (let child of allChildRet) {
            let isNeedUpdate = false
            // 如果变更了抽成比，且小于子用户抽成比，同步子用户抽成比
            if (isChangeRate && user.rate < child.rate) {
                child.rate = user.rate
                isNeedUpdate = true
            }
            // 如果减少游戏，则同步子用户游戏
            if (isChangeGameList) {
                let subGameList = []
                for (let item of child.gameList) {
                    if (_.indexOf(gameListDifference, item.code) == -1) {
                        subGameList.push(item)
                    }
                }
                //修改子用户mix在父级mix之内
                for (let gameItem of user.gameList) {
                    for (let subItem of subGameList) {
                        if (subItem.code == gameItem.code) {
                            if (+subItem.mix > +gameItem.mix) {
                                subItem.mix = gameItem.mix
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