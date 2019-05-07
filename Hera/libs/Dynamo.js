// 所有数据库表
const Tables = {
    HeraGameRecord: "HeraGameRecord",
    ZeusPlatformUser: "ZeusPlatformUser",
    ZeusPlatformLog: "ZeusPlatformLog",
    ZeusPlatformBill: "ZeusPlatformBill",
    PlayerBillDetail: "PlayerBillDetail",
    HeraGamePlayer: "HeraGamePlayer",
    StatRound: "StatRound",
    SYSTransfer: "SYSTransfer",
    SYSCacheBalance: "SYSCacheBalance"
}

//玩家游戏状态枚举
const GameStateEnum = {
    OffLine: 1,     //离线
    OnLine: 2,      //在线
    GameIng: 3      //游戏中
}


module.exports = {
    Tables,
    GameStateEnum
}