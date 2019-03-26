const _ = require('lodash')
const StatusEnum = require('../lib/UserConsts').StatusEnum
const BizErr = require('../lib/Codes').BizErr
const RoleDisplay = require('../lib/UserConsts').RoleDisplay
const RoleModels = require('../lib/UserConsts').RoleModels
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const Model = require('../lib/Model').Model
const GlobalConfig = require("../util/config")
const BaseModel = require('./BaseModel')
const UserModel = require('./UserModel')
const BillModel = require('./BillModel')
const SubRoleModel = require('./SubRoleModel')
const CaptchaModel = require('../model/CaptchaModel')

class AgentModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.TABLE_MERCHANT,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            role: Model.StringValue,
            userId: Model.StringValue
        }
    }

    /**
     * 注册代理管理员
     * @param {*} userInfo 输入用户信息
     */
    async registerAdmin(userInfo) {
        // 默认值设置
        const adminRole = RoleModels[RoleCodeEnum.Agent]()
        const CheckUser = { ...adminRole, ...userInfo, passhash: Model.hashGen(userInfo.password) }
        // 查询用户是否已存在
        const queryUserRet = await new UserModel().checkUserBySuffix(CheckUser.role, CheckUser.suffix, CheckUser.username)
        if (!queryUserRet) {
            throw BizErr.UserExistErr()
        }
        // 保存用户，处理用户名前缀
        const User = { ...CheckUser, uname: `${CheckUser.username}`, username: `${CheckUser.username}` }
        const saveUserRet = await saveUser(User)
        return saveUserRet
    }

    /**
     * 专门用于创建代理
     * @param {*} token 身份令牌
     * @param {*} userInfo 输入用户信息
     */
    async register(token = {}, userInfo = {}) {
        // 获取代理角色模型
        const bizRole = RoleModels[RoleCodeEnum.Agent]()
        // 生成注册用户信息
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
        // 如果parent未指定,则为管理员. 从当前管理员对点数中扣去点数进行充值. 点数不可以为负数.而且一定是管理员存点到新用户
        const parentUser = await queryParent(token, CheckUser.parent)
        // 检查下级洗码比
        // if (parentUser.level != 0 && (userInfo.vedioMix > parentUser.vedioMix || userInfo.liveMix > parentUser.liveMix)) {
        //     return [BizErr.InparamErr('洗码比不能高于上级'), 0]
        // }
        // 检查下级成数
        if (parentUser.level != 0 && (userInfo.rate > parentUser.rate)) {
            throw BizErr.InparamErr('成数比不能高于上级')
        }
        // 初始点数
        const initPoints = CheckUser.points
        // 检查余额
        const balance = await new BillModel().checkUserBalance(token, parentUser)
        if (initPoints > balance) {
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
            username: `${CheckUser.username}`,
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
        var orderId = depositRet.sn
        return { ...saveUserRet, orderId: orderId }
    }

    /**
     * 代理登录
     * @param {*} userLoginInfo 用户登录信息
     */
    async login(userLoginInfo = {}) {
        // 是否检查验证码
        if (!userLoginInfo.mobileFlag) { //如果有flag标识 代表是移动端 不校验验证码
            // 检查验证码
            await new CaptchaModel().check(userLoginInfo)
            // if (!userLoginInfo.vid || !userLoginInfo.challenge) {
            //     throw BizErr.CaptchaErr('验证码错误')
            // }
        }
        // 获取代理角色模型
        const Role = RoleModels[userLoginInfo.role]()
        // 组装用户登录信息
        const UserLoginInfo = _.pick({
            ...Role,
            ...userLoginInfo
        }, _.keys(Role))
        const username = UserLoginInfo.username
        // 查询用户信息
        const User = await new UserModel().getUserByName(userLoginInfo.role, username)
        // 校验用户密码
        if (!Model.hashValidate(User.password, UserLoginInfo.password)) {
            throw BizErr.PasswordErr()
        }
        // 检查用户是否被锁定
        if (User.status == StatusEnum.Disable) {
            throw BizErr.UserLockedErr()
        }
        // 更新用户信息
        new UserModel().updateItem({
            Key: { role: User.role, userId: User.userId },
            UpdateExpression: 'SET lastIP = :lastIP',
            ExpressionAttributeValues: {
                ':lastIP': UserLoginInfo.lastIP
            }
        })
        // 代理管理员，获取二级权限
        if (Model.isAgentAdmin(User)) {
            const subRole = await new SubRoleModel().getOne({ name: User.subRole })
            User.subRolePermission = subRole.permissions
        }
        // 返回用户身份令牌
        let saveUserRet = _.pick(User, RoleDisplay[User.role])
        saveUserRet.subRolePermission = User.subRolePermission
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
            displayId: saveUserRet.displayId,
            sn: saveUserRet.sn,
            subRole: saveUserRet.subRole,
            subRolePermission: saveUserRet.subRolePermission
        }
        return { ...saveUserRet, token: Model.token(minitoken) }
    }

    /**
     * 查询代理列表
     * @param {*} token
     * @param {*} inparam
     */
    async page(token, inparam) {
        let query = {
            IndexName: 'RoleParentIndex',
            KeyConditionExpression: '#role = :role and parent = :parent',
            ProjectionExpression: 'userId,sn,displayName,msn,parent,parentDisplayName,balance,gameList,createdAt,loginAt,#status,remark,suffix,uname,username,#role,#rate,#level,levelIndex,parentName,parentRole,points,chip,isTest',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#status': 'status',
                '#rate': 'rate',
                '#level': 'level'
            }
        }
        if (inparam.isTest == 0) {              //只查正式代理的
            query.FilterExpression = 'isTest<>:isTest'
            query.ExpressionAttributeValues = {
                ':parent': inparam.parent,
                ':role': RoleCodeEnum.Agent,
                ':isTest': 1
            }
        } else if (inparam.isTest == 1) {       //只查测试代理的
            query.FilterExpression = 'isTest=:isTest'
            query.ExpressionAttributeValues = {
                ':parent': inparam.parent,
                ':role': RoleCodeEnum.Agent,
                ':isTest': inparam.isTest
            }
        } else {                                 //全查平台代理
            query.ExpressionAttributeValues = {
                ':parent': inparam.parent,
                ':role': RoleCodeEnum.Agent
            }
        }
        // 条件搜索
        const queryRet = await this.bindFilterQuery(query, inparam.query, true)
        // // 去除敏感数据
        // const users = _.map(queryRet.Items, (item) => {
        //     item.passhash = null
        //     if (!Model.isAgentAdmin(token)) {
        //         item.password = '********'
        //     }
        //     return item
        // })
        // 排序输出
        let sortResult = _.sortBy(queryRet.Items, [inparam.sortkey || 'createdAt'])
        if (inparam.sort == 'desc') { sortResult = sortResult.reverse() }
        return sortResult
    }

    /**
     * 查询管理员列表
     * @param {*} token 
     * @param {*} inparam 
     */
    async adminPage(token, inparam) {
        inparam.query ? inparam.query.suffix = 'Agent' : inparam.query = { suffix: 'Agent' }
        let query = {
            KeyConditionExpression: '#role = :role',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Agent
            }
        }
        // 条件搜索
        const adminRet = await this.bindFilterQuery(query, inparam.query, true)
        // 去除敏感数据
        adminRet.Items = _.map(adminRet.Items, (item) => {
            item.passhash = null
            return item
        })
        // 排序输出
        let sortResult = _.sortBy(adminRet.Items, [inparam.sortkey || 'createdAt']).reverse()
        if (inparam.sort == 'desc') { sortResult = sortResult.reverse() }
        return sortResult
    }
}

// 私有方法：查询用户上级
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

// 私有方法：保存用户
const saveUser = async (userInfo) => {
    // 设置编码,获取六位随机数
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
        //存在重新取值
        res.Items.length == 0 ? checkExist = false : userInfo.displayId = Model.randomNum(6)
    }
    // 组装用户信息，保存用户
    const baseModel = Model.baseModel()
    const UserItem = { ...baseModel, ...userInfo, updatedAt: Date.now(), loginAt: Date.now() }
    await new BaseModel().db$('put', { TableName: GlobalConfig.TABLE_NAMES.TABLE_MERCHANT, Item: UserItem })
    return _.pick(UserItem, RoleDisplay[userInfo.role])
}

module.exports = AgentModel