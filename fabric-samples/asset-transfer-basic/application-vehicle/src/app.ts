/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as grpc from "@grpc/grpc-js";
import {
  connect,
  Contract,
  Identity,
  Signer,
  signers,
} from "@hyperledger/fabric-gateway";
import * as crypto from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import { TextDecoder } from "util";
const readline = require("readline");

const channelName = envOrDefault("CHANNEL_NAME", "vehicle");
const chaincodeName = envOrDefault("CHAINCODE_NAME", "vehicle-chaincode");
const mspId = envOrDefault("MSP_ID", "Org1MSP");

// Path to crypto materials.
const cryptoPath = envOrDefault(
  "CRYPTO_PATH",
  path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "test-network",
    "organizations",
    "peerOrganizations",
    "org1.example.com"
  )
);

// Path to user private key directory.
const keyDirectoryPath = envOrDefault(
  "KEY_DIRECTORY_PATH",
  path.resolve(cryptoPath, "users", "User1@org1.example.com", "msp", "keystore")
);

// Path to user certificate.
const certPath = envOrDefault(
  "CERT_PATH",
  path.resolve(
    cryptoPath,
    "users",
    "User1@org1.example.com",
    "msp",
    "signcerts",
    "cert.pem"
  )
);

// Path to peer tls certificate.
const tlsCertPath = envOrDefault(
  "TLS_CERT_PATH",
  path.resolve(cryptoPath, "peers", "peer0.org1.example.com", "tls", "ca.crt")
);

// Gateway peer endpoint.
const peerEndpoint = envOrDefault("PEER_ENDPOINT", "localhost:7051");

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault("PEER_HOST_ALIAS", "peer0.org1.example.com");

const utf8Decoder = new TextDecoder();
let id = 4;
const genVehicleId = () => {
  return String(id++);
};

async function main(): Promise<void> {
  await displayInputParameters();

  // The gRPC client connection should be shared by all Gateway connections to this endpoint.
  const client = await newGrpcConnection();

  const gateway = connect({
    client,
    identity: await newIdentity(),
    signer: await newSigner(),
    // Default timeouts for different gRPC calls
    evaluateOptions: () => {
      return { deadline: Date.now() + 5000 }; // 5 seconds
    },
    endorseOptions: () => {
      return { deadline: Date.now() + 15000 }; // 15 seconds
    },
    submitOptions: () => {
      return { deadline: Date.now() + 5000 }; // 5 seconds
    },
    commitStatusOptions: () => {
      return { deadline: Date.now() + 60000 }; // 1 minute
    },
  });

  try {
    // Get a network instance representing the channel where the smart contract is deployed.
    const network = gateway.getNetwork(channelName);

    // Get the smart contract from the network.
    const contract = network.getContract(chaincodeName);

    //체인코드 초기화
    await initLedger(contract);

    //org1_4 Vehicle 하나 생성
    await createVehicle(contract, "org1_4");

    //org1_4 Vehicle 불러오기
    await readVehicleByID(contract, "org1_4");

    //모든 Vehicle 불러오기
    await getAllVehicles(contract);

    //최용원 사용자가 org2_1 Vehicle 사용
    await useVehicle(contract, "org2_1", "최용원");

    //org2_1 Vehicle 불러오기
    await readVehicleByID(contract, "org2_1");

    //org1_4 Vehicle 삭제하기
    await deleteVehicle(contract, "org1_4");

    //모든 Vehicle 불러오기
    await getAllVehicles(contract);

    // while(open){
    // console.log("create: vehicle을 생성합니다")
    // console.log("init: 체인코드를 초기화합니다")
    // console.log("read <id>: vehicle id로 불러옵니다")
    // console.log("readAll: 모든 vehicle을 불러옵니다")
    // console.log("use <id> <user>: <user>가 <id>에 해당하는 vehicle을 사용합니다")
    // console.log("delete <id>: vehicle을 삭제합니다")
    // console.log("close: 앱을 종료합니다")

    // console.log("명령어를 입력해주세요 : ")

    // const rl = readline.createInterface({
    //     input: process.stdin,
    //     output: process.stdout,
    // });
    // rl.on('line', (line: string) => {
    //     input = line.split(" ")

    //     rl.close();
    // });
    // rl.on('close', async () => {
    // // 입력이 끝난 후 실행할 코드
    //     switch(input[0]){
    //         case 'init':
    //             await initLedger(contract);
    //             break;
    //         case 'create':
    //             await createVehicle(contract);
    //             break;
    //         case 'read':
    //             await readVehicleByID(contract, input[1]);
    //             break;
    //         case 'readAll':
    //             await getAllVehicles(contract);
    //             break;
    //         case 'use':
    //             await useVehicle(contract, input[1], input[2]);
    //             break;
    //         case 'delete':
    //             await deleteVehicle(contract, input[1]);
    //             break;
    //         case 'close':
    //             process.exit();
    //     }
    // })
    // }

    // Initialize a set of asset data on the ledger using the chaincode 'InitLedger' function.

    // Return all the current assets on the ledger.

    // Create a new asset on the ledger.

    // Update an existing asset asynchronously.

    // Get the asset details by assetID.

    // Update an asset which does not exist.
  } finally {
    gateway.close();
    client.close();
  }
}

main().catch((error) => {
  console.error("******** FAILED to run the application:", error);
  process.exitCode = 1;
});

async function newGrpcConnection(): Promise<grpc.Client> {
  const tlsRootCert = await fs.readFile(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(peerEndpoint, tlsCredentials, {
    "grpc.ssl_target_name_override": peerHostAlias,
  });
}

async function newIdentity(): Promise<Identity> {
  const credentials = await fs.readFile(certPath);
  return { mspId, credentials };
}

async function newSigner(): Promise<Signer> {
  const files = await fs.readdir(keyDirectoryPath);
  const keyPath = path.resolve(keyDirectoryPath, files[0]);
  const privateKeyPem = await fs.readFile(keyPath);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

/**
 * This type of transaction would typically only be run once by an application the first time it was started after its
 * initial deployment. A new version of the chaincode deployed later would likely not need to run an "init" function.
 */
async function initLedger(contract: Contract): Promise<void> {
  console.log(
    "\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger"
  );

  await contract.submitTransaction("InitLedger");

  console.log("*** Transaction committed successfully");
}

/**
 * Evaluate a transaction to query ledger state.
 */
async function getAllVehicles(contract: Contract): Promise<void> {
  console.log(
    "\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger"
  );

  const resultBytes = await contract.evaluateTransaction("GetAllVehicles");

  const resultJson = utf8Decoder.decode(resultBytes);
  const result = JSON.parse(resultJson);
  console.log("*** Result:", result);
}

/**
 * Submit a transaction synchronously, blocking until it has been committed to the ledger.
 */
async function createVehicle(
  contract: Contract,
  vehicleId: string
): Promise<void> {
  console.log(
    "\n--> Submit Transaction: CreateVehicle, creates new vehicle with ID, Org"
  );

  await contract.submitTransaction("CreateVehicle", vehicleId, "Org1");

  console.log("*** Transaction committed successfully");
}

async function deleteVehicle(
  contract: Contract,
  vehicleId: string
): Promise<void> {
  console.log(
    "\n--> Submit Transaction: DeleteVehicle, deletes vehicle with ID"
  );

  await contract.submitTransaction("DeleteAsset", vehicleId);

  console.log("*** Transaction committed successfully");
}

/**
 * Submit transaction asynchronously, allowing the application to process the smart contract response (e.g. update a UI)
 * while waiting for the commit notification.
 */
async function useVehicle(
  contract: Contract,
  vehicleId: string,
  user: string
): Promise<void> {
  console.log(
    "\n--> Async Submit Transaction: TransferAsset, updates existing asset owner"
  );

  const commit = await contract.submitAsync("UseVehicle", {
    arguments: [vehicleId, user],
  });
  const result: any = utf8Decoder.decode(commit.getResult());
  console.log(`해당 Vehicle은 ${result.User}에 의해 사용이 시작되었습니다.`);
  // console.log(`*** Successfully submitted transaction to transfer ownership from ${oldOwner} to Saptha`);
  console.log("*** Waiting for transaction commit");

  const status = await commit.getStatus();
  if (!status.successful) {
    throw new Error(
      `Transaction ${status.transactionId} failed to commit with status code ${status.code}`
    );
  }

  console.log("*** Transaction committed successfully");
}

async function readVehicleByID(
  contract: Contract,
  vehicleId: string
): Promise<void> {
  console.log(
    "\n--> Evaluate Transaction: ReadVehicle, function returns vehicle attributes"
  );

  const resultBytes = await contract.evaluateTransaction(
    "ReadVehicle",
    vehicleId
  );

  const resultJson = utf8Decoder.decode(resultBytes);
  const result = JSON.parse(resultJson);
  console.log("*** Result:", result);
}

/**
 * submitTransaction() will throw an error containing details of any error responses from the smart contract.
 */
async function updateNonExistentAsset(contract: Contract): Promise<void> {
  console.log(
    "\n--> Submit Transaction: UpdateAsset asset70, asset70 does not exist and should return an error"
  );

  try {
    await contract.submitTransaction(
      "UpdateAsset",
      "asset70",
      "blue",
      "5",
      "Tomoko",
      "300"
    );
    console.log("******** FAILED to return an error");
  } catch (error) {
    console.log("*** Successfully caught the error: \n", error);
  }
}

/**
 * envOrDefault() will return the value of an environment variable, or a default value if the variable is undefined.
 */
function envOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * displayInputParameters() will print the global scope parameters used by the main driver routine.
 */
async function displayInputParameters(): Promise<void> {
  console.log(`channelName:       ${channelName}`);
  console.log(`chaincodeName:     ${chaincodeName}`);
  console.log(`mspId:             ${mspId}`);
  console.log(`cryptoPath:        ${cryptoPath}`);
  console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
  console.log(`certPath:          ${certPath}`);
  console.log(`tlsCertPath:       ${tlsCertPath}`);
  console.log(`peerEndpoint:      ${peerEndpoint}`);
  console.log(`peerHostAlias:     ${peerHostAlias}`);
}
