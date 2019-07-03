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
        // 管理员查询
        let query = {
            IndexName: 'LogRoleIndex',
            ProjectionExpression: 'userId,createdAt,detail,ret,#role,suffix,#type,username,lastIP,lastLogin,levelIndex,userStatus,displayName,#action,operateToken',
            ScanIndexForward: false,
            KeyConditionExpression: "#role = :role",
            FilterExpression: "#type = :type",
            ExpressionAttributeNames: {
                '#role': 'role',
                '#type': 'type',
                '#action': 'action',
            },
            ExpressionAttributeValues: {
                ':role': inparam.role.toString(),
                ':type': inparam.type
            }
        }
        // 线路商|商户查询(查自己和自己下一级)
        if (inparam.parent && (inparam.role == '10' || inparam.role == '100')) {
            query = {
                IndexName: 'LogRoleIndex',
                ProjectionExpression: 'userId,createdAt,detail,ret,#role,suffix,#type,username,lastIP,lastLogin,levelIndex,userStatus,displayName,#action,operateToken',
                ScanIndexForward: false,
                KeyConditionExpression: "#role = :role",
                FilterExpression: "(#type = :type AND userId = :parent) OR (#type = :type AND #parent = :parent)",
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#type': 'type',
                    '#action': 'action',
                    '#parent': 'parent'
                },
                ExpressionAttributeValues: {
                    ':role': inparam.role.toString(),
                    ':type': inparam.type,
                    ':parent': inparam.parent
                }
            }
        }
        // 调试日志
        if (inparam.type == 'settlement') {
            query = {
                IndexName: 'LogRoleIndex',
                ProjectionExpression: 'userId,createdAt,detail,ret,#role,#type,inparams',
                ScanIndexForward: false,
                KeyConditionExpression: "#role = :role",
                FilterExpression: "ret = :ret",
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#type': 'type'
                },
                ExpressionAttributeValues: {
                    ':role': inparam.role.toString(),
                    ':ret': 'N',
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
            parent: inparam.operateToken.parent || '0'
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
        let userId = loginUserRet.userId || '0'
        let role = loginUserRet.role
        let suffix = loginUserRet.suffix
        let username = loginUserRet.username
        let lastIP = loginUserRet.lastIP
        let lastLogin = new Date().getTime()
        let userStatus = StatusEnum.Enable
        let parent = loginUserRet.parent || '0'
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
            suffix = userLoginInfo.suffix || 'Platform'
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
            case '2':
                let log = {
                    ...this.item,
                    createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
                    detail: error,
                    inparams: inparam,
                    ret: 'N',
                    role: role,
                    type: inparam.type,
                    userId: inparam.userId.toString(),
                    userName: inparam.userName,
                }
                if (log.inparams && typeof log.inparams == 'object') {
                    for (let key in log.inparams) {
                        if (!log.inparams[key] && (log.inparams[key] != '0' || log.inparams[key] != 0)) {
                            delete log.inparams[key]
                        }
                    }
                }
                this.putItem(log)
                break;
            case '6':
                this.putItem({
                    ...this.item,
                    createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
                    detail: error,
                    inparams: inparam,
                    ret: 'N',
                    role: role,
                    type: '/player/force',
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
                    detail:`【${moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}】，将【${inparam.changeUser}】的【${inparam.company}】游戏，进行如下操作【${inparam.detail}】`,
                    inparams: '人工修复',
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
                    detail: `${inparam.userName}:游戏列表发生了变更`,
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
}
