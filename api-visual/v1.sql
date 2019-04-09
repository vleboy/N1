-- Adminer 4.7.1 MySQL dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

DROP DATABASE IF EXISTS `v1`;
CREATE DATABASE `v1` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */;
USE `v1`;

DROP TABLE IF EXISTS `bill`;
CREATE TABLE `bill` (
  `sn` varchar(50) NOT NULL,
  `businessKey` varchar(50) NOT NULL,
  `parent` varchar(36) NOT NULL,
  `userId` int(11) NOT NULL,
  `userName` varchar(20) NOT NULL,
  `gameType` int(11) NOT NULL,
  `gameId` int(11) NOT NULL,
  `type` int(11) NOT NULL,
  `originalAmount` double NOT NULL,
  `amount` double NOT NULL,
  `balance` double NOT NULL,
  `sourceIP` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '0.0.0.0',
  `createdAt` bigint(20) NOT NULL,
  PRIMARY KEY (`sn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DROP TABLE IF EXISTS `config`;
CREATE TABLE `config` (
  `type` varchar(20) NOT NULL,
  `createdAt` bigint(20) NOT NULL,
  `flag` tinyint(4) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- 2019-04-09 08:19:37