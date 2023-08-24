# 하이퍼레저 패브릭 실습

## 환경

### Org

- Org1
- Org2

## 실습

### 1. ./network.sh up 실행

```sh
./network.sh up createChannel -c vehicle -ca
```

### 2. 체인코드 배포

체인코드 경로
`fabric-samples/asset-transfer-basic/chaincode-javascript`

```sh
./network.sh deployCC -ccn vehicle-chaincode -ccp ../asset-transfer-basic/chaincode-javascript/ -ccl javascript -c vehicle
```

### 3. vehicle-application으로 체인코드 실행

애플리케이션 경로
`fabric-samples/asset-transfer-basic/application-vehicle`

```sh
npm i
npm start
```
