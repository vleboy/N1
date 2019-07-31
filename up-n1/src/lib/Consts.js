/**
 * type类型说明：1真人 2电子 3街机 4棋牌 5体育 6捕鱼
 */
const GameTypeEnum = {
    '10000': { type: 4, code: '10000', name: 'NA棋牌游戏', company: 'NA' },
    '30000': { type: 1, code: '30000', name: 'NA真人视讯', company: 'NA' },
    '40000': { type: 2, code: '40000', name: 'NA电子游戏', company: 'NA' },
    '50000': { type: 3, code: '50000', name: 'NA街机游戏', company: 'NA' },
    '60000': { type: 6, code: '60000', name: 'NA捕鱼游戏', company: 'NA' },
    '70000': { type: 2, code: '70000', name: 'H5电子游戏', company: 'NA' },
    '80000': { type: 1, code: '80000', name: 'H5真人视讯', company: 'NA' },
    '90000': { type: 2, code: '90000', name: 'H5电子游戏-无神秘奖', company: 'NA' },
    '1010000': { type: 2, code: '1010000', name: 'TTG电子游戏', company: 'TTG' },
    '1020000': { type: 2, code: '1020000', name: 'PNG电子游戏', company: 'PNG' },
    '10300000': { type: 2, code: '10300000', name: 'MG电子游戏', company: 'MG' },
    '1040000': { type: 2, code: '1040000', name: 'HABA电子游戏', company: 'HABA' },
    '1050000': { type: 1, code: '1050000', name: 'AG真人游戏', company: 'AG' },
    '1060000': { type: 1, code: '1060000', name: 'SA真人游戏', company: 'SA' },
    '1070000': { type: 4, code: '1070000', name: 'KY棋牌游戏', company: 'KY' },
    '1080000': { type: 2, code: '1080000', name: 'SB电子游戏', company: 'SB' },
    '1090000': { type: 2, code: '1090000', name: 'PG电子游戏', company: 'PG' },
    '1100000': { type: 4, code: '1100000', name: 'VG棋牌游戏', company: 'VG' },
    '1110000': { type: 6, code: '1110000', name: 'SA捕鱼游戏', company: 'SA' },
    '1120000': { type: 1, code: '1120000', name: 'SB真人游戏', company: 'SB' },
    '1130000': { type: 5, code: '1130000', name: 'YSB体育游戏', company: 'YSB' },
    '1140000': { type: 2, code: '1140000', name: 'RTG电子游戏', company: 'RTG' },
    '1150000': { type: 2, code: '1150000', name: 'DT电子游戏', company: 'DT' },
    '1160000': { type: 2, code: '1160000', name: 'PP电子游戏', company: 'PP' },
}
const GameListEnum = {
    "NA": [
        // { company: 'NA', code: '3', name: 'NA商城' },
        { company: 'NA', code: '10000', name: 'NA棋牌游戏', type: 4 },
        { company: 'NA', code: '30000', name: 'NA真人视讯', type: 1 },
        { company: 'NA', code: '40000', name: 'NA电子游戏', type: 2 },
        { company: 'NA', code: '50000', name: 'NA街机游戏', type: 3 },
        { company: 'NA', code: '60000', name: 'NA捕鱼游戏', type: 6 },
        { company: 'NA', code: '70000', name: 'H5电子游戏', type: 2 },
        { company: 'NA', code: '80000', name: 'H5真人视讯', type: 1 },
        { company: 'NA', code: '90000', name: 'H5电子游戏-无神秘奖', type: 2 }
    ],
    "TTG": [
        { company: 'TTG', code: '1010000', name: 'TTG电子游戏', type: 2 }
    ],
    "PNG": [
        { company: 'PNG', code: '1020000', name: 'PNG电子游戏', type: 2 },
    ],
    "MG": [
        { company: 'MG', code: '10300000', name: 'MG电子游戏', type: 2 }
    ],
    "HABA": [
        { company: 'HABA', code: '1040000', name: 'HABA电子游戏', type: 2 },
    ],
    "AG": [
        { company: 'AG', code: '1050000', name: 'AG真人游戏', type: 1 }
    ],
    "SA": [
        { company: 'SA', code: '1060000', name: 'SA真人游戏', type: 1 },
        { company: 'SA', code: '1110000', name: 'SA捕鱼游戏', type: 6 }
    ],
    "KY": [
        { company: 'KY', code: '1070000', name: 'KY棋牌游戏', type: 4 }
    ],
    "PG": [
        { company: 'PG', code: '1090000', name: 'PG电子游戏', type: 2 }
    ],
    "YSB": [
        { company: 'YSB', code: '1130000', name: 'YSB体育游戏', type: 5 }
    ],
    "RTG": [
        { company: 'RTG', code: '1140000', name: 'RTG电子游戏', type: 2 }
    ],
    "SB": [
        { company: 'SB', code: '1080000', name: 'SB电子游戏', type: 2 },
        { company: 'SB', code: '1120000', name: 'SB真人游戏', type: 1 }
    ],
    "DT": [
        { company: 'DT', code: '1150000', name: 'DT电子游戏', type: 2 },
    ],
    "PP": [
        { company: 'PP', code: '1160000', name: 'PP电子游戏', type: 2 },
    ],
    "VG":[
        { company: 'VG', code: '1100000', name: 'VG棋牌游戏', type: 4 },
    ]
}

/**
 * 具体游戏id枚举
 */
const GameNameEnum = {
    "70001": "塔罗之谜",
    "70002": "小厨娘",
    "70003": "降龙献瑞",
    "70004": "四方神兽",
    "70005": "财神进宝",
    "70006": "福运亨通",
    "70007": "熊猫传奇",
    "70010": "财源广进",
    "70011": "珠光宝气",
    "70012": "锦鲤",
    "70013": "金狮送福",
    "70014": "幸运钱庄",
    "70022": "年年有余",
    "70024": "猪年大吉",
    "70026": "财神到",
    "70028": "老寿星",
    "70030": "凤舞朝阳",
    "70032": "鲤跃龙门",

    "90001": "塔罗之谜",
    "90002": "小厨娘",
    "90003": "祥龙献瑞",
    "90004": "四方神兽",
    "90005": "财神进宝",
    "90006": "福运亨通",
    "90007": "熊猫传奇",
    "90008": "财源广进",
    "90009": "珠光宝气",
    "90010": "锦鲤",
    "90011": "金狮送福",
    "90012": "幸运钱庄",
    "90013": "年年有余",
    "90014": "猪年大吉",
    "90015": "财神到",
    "90016": "老寿星",
    "90017": "凤舞朝阳",
    "90018": "鲤跃龙门"
}
/**
 * 游戏公司枚举
 */
const CompanyEnum = [
    { company: 'AG', companyName: 'Ag' },
    { company: 'DT', companyName: 'DT' },
    { company: 'HABA', companyName: 'HABA' },
    { company: 'MG', companyName: 'MG' },
    { company: 'NA', companyName: 'NA' },
    { company: 'PG', companyName: 'PG' },
    { company: 'PNG', companyName: 'PNG' },
    { company: 'PP', companyName: 'PP' },
    { company: 'RTG', companyName: 'RTG' },
    { company: 'SA', companyName: 'SA' },
    { company: 'SB', companyName: 'SB' },
    { company: 'TTG', companyName: 'TTG' },
    { company: 'YSB', companyName: 'YSB' }
]

//玩家游戏状态枚举
const GameStateEnum = {
    OffLine: 1,     //离线
    OnLine: 2,      //在线
    GameIng: 3      //游戏中
}


const RoleCodeEnum = {
    'SuperAdmin': '0',
    'PlatformAdmin': '1',
    'Manager': '10',
    'Merchant': '100',
    'Agent': '1000',
    'Player': '10000'
}

// 游戏厂商状态枚举
const CompanyStatusEnum = {
    Enable: 1,
    Disable: 0
}
// 游戏状态枚举
const GameStatusEnum = {
    Online: 1,
    Offline: 0
}


module.exports = {
    GameTypeEnum,
    GameListEnum,
    CompanyEnum,
    GameStateEnum,
    RoleCodeEnum,
    CompanyStatusEnum,
    GameStatusEnum
}