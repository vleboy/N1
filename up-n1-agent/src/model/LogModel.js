const StatusEnum = require('../lib/UserConsts').StatusEnum
const uuid = require('uuid/v4')
const Codes = require('../lib/Codes').Codes
const config = require('config')
const BaseModel = require('./BaseModel')
const moment = require('moment')

/**
 * 实际业务子类，继承于BaseModel基类
 */
module.exports = class LogModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.ZeusPlatformLog
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            sn: uuid(),
            userId: 'NULL!'
        }
    }

    /**
     * 分页查询日志
     * @param {*} inparam 
     */
    async logPage(inparam) {
        let query = {}
        // 管理员查询管理员相关的日志
        if (!inparam.parent && inparam.level === 0) {
            query = {
                IndexName: 'LogRoleIndex',
                ProjectionExpression: 'userId,createdAt,detail,ret,#role,suffix,#type,username,lastIP,lastLogin,levelIndex,userStatus,displayName,#action,operateToken',
                ScanIndexForward: false,
                KeyConditionExpression: "#role = :role",
                FilterExpression: "#type = :type AND (#level = :level OR #username = :username)",
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#type': 'type',
                    '#action': 'action',
                    '#level': 'level',
                    '#username': 'username'
                },
                ExpressionAttributeValues: {
                    ':role': inparam.role.toString(),
                    ':type': inparam.type,
                    ':level': inparam.level,
                    ':username': 'NAagent'
                }
            }
        }
        // 管理员查询普通用户的日志
        else if (!inparam.parent && inparam.level === -1) {
            query = {
                IndexName: 'LogRoleIndex',
                ProjectionExpression: 'userId,createdAt,detail,ret,#role,suffix,#type,username,lastIP,lastLogin,levelIndex,userStatus,displayName,#action,operateToken',
                ScanIndexForward: false,
                KeyConditionExpression: "#role = :role",
                FilterExpression: "#type = :type AND #level <> :level",
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#type': 'type',
                    '#action': 'action',
                    '#level': 'level',
                },
                ExpressionAttributeValues: {
                    ':role': inparam.role.toString(),
                    ':type': inparam.type,
                    ':level': 0
                }
            }
        }
        // 管理员查询指定level的普通用户的日志
        else if (!inparam.parent) {
            query = {
                IndexName: 'LogRoleIndex',
                ProjectionExpression: 'userId,createdAt,detail,ret,#role,suffix,#type,username,lastIP,lastLogin,levelIndex,userStatus,displayName,#action,operateToken',
                ScanIndexForward: false,
                KeyConditionExpression: "#role = :role",
                FilterExpression: "#type = :type AND #level = :level",
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#type': 'type',
                    '#action': 'action',
                    '#level': 'level'
                },
                ExpressionAttributeValues: {
                    ':role': inparam.role.toString(),
                    ':type': inparam.type,
                    ':level': inparam.level
                }
            }
        }
        // 普通代理查询自己和下级的日志
        if (inparam.parent) {
            query = {
                IndexName: 'LogRoleIndex',
                ProjectionExpression: 'userId,createdAt,detail,ret,#role,suffix,#type,username,lastIP,lastLogin,levelIndex,userStatus,displayName,#action,operateToken',
                ScanIndexForward: false,
                KeyConditionExpression: "#role = :role",
                FilterExpression: "(#type = :type AND #userId = :parent) OR (#type = :type AND #parent = :parent)",
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#type': 'type',
                    '#action': 'action',
                    '#parent': 'parent',
                    '#userId': 'userId'
                },
                ExpressionAttributeValues: {
                    ':role': inparam.role.toString(),
                    ':type': inparam.type,
                    ':parent': inparam.parent
                }
            }
        }
        //inparam.LastEvaluatedKeyTemplate = ['createdAt', 'role', 'sn', 'userId']
        return await this.bindFilterPage(query, inparam.query, true, inparam)
    }

    /**
     * 添加操作日志
     * @param {*} inparam 
     * @param {*} error 
     * @param {*} result 
     */
    addOperate(inparam, error, result) {
        let userId = inparam.operateToken.userId
        let role = inparam.operateToken.role
        let suffix = inparam.operateToken.suffix
        let username = inparam.operateToken.username
        let lastIP = inparam.lastIP
        let type = 'operate'
        let action = inparam.operateAction
        let inparams = inparam
        let ret = 'Y'
        let detail = result
        let level = parseInt(inparam.operateToken.level)
        let levelIndex = inparam.operateToken.levelIndex
        if (error && error != 'NULL!') {
            ret = 'N'
            detail = error
        }
        this.putItem({
            ...this.item,
            userId: userId,
            role: role,
            suffix: suffix,
            level: level,
            levelIndex: levelIndex,
            username: username,
            lastIP: lastIP,
            type: type,
            action: action,
            inparams: inparams,
            ret: ret,
            detail: detail,
            operateToken: inparam.operateToken,
            parent: inparam.operateToken.parent ? inparam.operateToken.parent : '0'
        }).then((res) => {
        }).catch((err) => {
            console.error(err)
        })
    }

    /**
     * 添加登录日志
     * @param {*} loginUserRet 
     */
    addLogin(userLoginInfo, loginUserErr, loginUserRet) {
        let detail = '登录成功'
        let userId = loginUserRet.userId ? loginUserRet.userId : '0'
        let role = loginUserRet.role
        let suffix = loginUserRet.suffix
        let username = loginUserRet.username
        let lastIP = loginUserRet.lastIP
        let lastLogin = new Date().getTime()
        let userStatus = StatusEnum.Enable
        let parent = loginUserRet.parent ? loginUserRet.parent : '0'
        let level = parseInt(loginUserRet.level)
        let ret = 'Y'
        if (!level && level != 0) {
            level = '-1'
        }
        let levelIndex = loginUserRet.levelIndex
        if (!levelIndex && levelIndex != '0' && levelIndex != 0) {
            levelIndex = '-1'
        }

        if (loginUserErr) {
            ret = 'N'
            detail = '登录失败'
            role = userLoginInfo.role
            suffix = userLoginInfo.suffix ? userLoginInfo.suffix : 'Platform'
            username = userLoginInfo.username
            lastIP = userLoginInfo.lastIP
            lastLogin = new Date().getTime()
            if (loginUserErr.code == Codes.CaptchaErr) {
                detail = '验证码输入错误'
            }
            if (loginUserErr.code == Codes.UserNotFound) {
                detail = '用户未找到'
            }
            if (loginUserErr.code == Codes.PasswordError) {
                detail = '密码输入错误'
            }
            if (loginUserErr.code == Codes.UserLocked) {
                detail = '帐号锁定'
                userStatus = StatusEnum.Disable
            }
        }
        this.putItem({
            ...this.item,
            parent: parent,
            userId: userId,
            role: role,
            suffix: suffix,
            level: level,
            levelIndex: levelIndex,
            username: username,
            displayName: loginUserRet.displayName,
            type: 'login',
            lastIP: lastIP,
            lastLogin: lastLogin,
            userStatus: userStatus,
            detail: detail,
            ret: ret
        }).then((res) => {
        }).catch((err) => {
            console.error(err)
        })
    }

    /**
     * 添加日志
     * @param {*} role 
     * @param {*} error 
     * @param {*} inparam 
     */
    add(role, error, inparam) {
        switch (role) {
            case '4':
                this.putItem({
                    ...this.item,
                    createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
                    detail: `玩家【${inparam.userName}】【${inparam.userId}】在【${inparam.gameType}】第三方游戏系统，时间范围【${moment(inparam.createdAt - 60000).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}-${moment(inparam.createdAt + 300000).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}】没有查找到游戏结果`,
                    inparams: inparam,
                    ret: 'N',
                    role: role,
                    type: 'anotherGameDataError',
                    userId: inparam.userId.toString(),
                    userName: inparam.userName
                }).then((res) => {
                }).catch((err) => {
                    console.error(err)
                })
                break;
            case '7':
                this.putItem({
                    ...this.item,
                    createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
                    detail: inparam.detail + "的账户：" + inparam.changeUser,
                    inparams: error,
                    ret: 'N',
                    role: role,
                    type: 'manualControl',
                    userId: inparam.userId.toString(),
                    userName: inparam.userName || 'NULL!',
                    topAmount: inparam.topAmount || 0,
                    totalWinloseAmount: inparam.totalWinloseAmount || 0,
                    company: inparam.company || 'NULL!'
                }).then((res) => {
                }).catch((err) => {
                    console.error(err)
                })
                break;
            case '8':
                this.putItem({
                    ...this.item,
                    createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
                    detail: `游戏列表发生了变更`,
                    inparams: error,
                    ret: 'N',
                    role: role,
                    type: 'gameChange',
                    userId: inparam.userId.toString(),
                    userName: inparam.userName,
                    operateName: inparam.operateName,
                    gameListBefore: inparam.gameListBefore,
                    gameListAfter: inparam.gameListAfter
                }).then((res) => {
                }).catch((err) => {
                    console.error(err)
                })
                break;
            default:
                break;
        }
    }

    /**
     * 添加日志
     * @param {*} role 
     * @param {*} type 
     * @param {*} inparam 
     * @param {*} detail
     * @param {*} options
     */
    addTwo(role, type, inparam, detail, options) {
        let log = {
            ...this.item,
            createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
            detail: detail,
            inparams: inparam,
            ret: 'N',
            role: role,
            type: type,
            userId: inparam.userId.toString(),
            userName: inparam.userName,
        }
        if (role == '3') {
            log.betTime = options
        }
        if (log.inparams && typeof log.inparams == 'object') {
            for (let key in log.inparams) {
                if (!log.inparams[key] && (log.inparams[key] != '0' || log.inparams[key] != 0)) {
                    delete log.inparams[key]
                }
            }
        }
        this.putItem(log)
    }
}
