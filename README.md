<p align="center"><img src="https://files.gitbook.com/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F4CrgOoWVfArUeF98XmqT%2Fuploads%2FamnVSgqid1POJGpb8Drp%2FScreenshot%202024-01-01%20at%2011.28.27%20AM.png?alt=media&token=1fd456f7-bfc9-48cd-9de0-d80f1aa1639c"></p>

## Usage for Hedera Consensus Service ease-of-use

### Idea
The HCS-20 standard is designed to leverage the Hedera Consensus Service (HCS) for creating, managing, and transferring digital assets represented as points. It utilizes topic IDs on the Hedera network to record JSON-encoded transactions, providing a framework for a fungible token system.

### Operations
- **Deploy Point Contract**: Initialize a new point asset on the network.
- **Mint Point**: Create new points and assign them to a recipient.
- **Burn Point**: Permanently remove a specified number of points from circulation.
- **Transfer Point**: Move points from one account to another.

### State Calculation
The state (such as balances) of HCS-20 points is determined by aggregating the activities of deploy, mint, and transfer operations inscribed onto the HCS topic IDs.

- **Deployments** initialize the point contract without directly affecting state.
- **Mints** add to the balance of the first owner specified in the mint operation.
- **Transfers** adjust balances by deducting from the sender and crediting the receiver.

### Frontend Implementation
Frontend applications can interact with the HCS-20 standard by submitting the JSON operations to specified topic IDs on the Hedera network and reading the state from these topics.

### How to Use HCS-20
1. **Deploying a Point Contract**: Optionally create your own point asset by inscribing a deploy operation.
2. **Minting Points**: Mint new points by inscribing the mint operation with the specified amount and recipient.
3. **Transferring Points**: Transfer points by inscribing the transfer operation with the relevant details.

### Validity of Transactions
- A transfer is valid if the amount does not exceed the available balance at the time of inscription.
- The order of transactions within the same block matters for determining validity.
- Redundancies can be resolved by transferring the point back to oneself.

### Important Notes
- Use only with Hedera-compatible wallets.
- Each inscription type (deploy, mint, transfer) plays a unique role in the point's lifecycle.
- The mint and transfer operations are the only ones that cause a change in balance.
- Be cautious with address changes in wallets and ensure correct addresses are used for transactions.

This standard offers a robust framework for creating a auditable point system on the Hedera network, leveraging the efficiency and security of the HCS.

### Deploy Points
```json
{
  "p": "hcs-20",
  "op": "deploy",
  "name": "point_name",
  "tick": "unique_point_identifier",
  "max": "max_supply",
  "lim": "optional_limit_of_mint_per_transaction",
  "metadata": "optional_metadata"
}
```
**Attributes Table:**

| Key      | Required | Description                                                  |
|----------|----------|--------------------------------------------------------------|
| `p`      | Yes      | Protocol identifier, specifies HCS-20                         |
| `op`     | Yes      | Operation type, here it's 'deploy'                            |
| `name`   | Yes      | Name of the point, describes the asset being created         |
| `tick`   | Yes      | Unique identifier for the point, akin to a ticker symbol     |
| `max`    | Yes      | Maximum supply of the point, sets the upper limit            |
| `lim`    | No       | Limit per transaction for minting, optional                  |
| `metadata` | No     | Optional additional data related to the point                |

### Mint Points
```json
{
  "p": "hcs-20",
  "op": "mint",
  "tick": "unique_point_identifier",
  "amt": "number_of_points",
  "to": "recipient_hedera_address"
}
```
**Attributes Table:**

| Key      | Required | Description                                                |
|----------|----------|------------------------------------------------------------|
| `p`      | Yes      | Protocol identifier, specifies HCS-20                       |
| `op`     | Yes      | Operation type, here it's 'mint'                            |
| `tick`   | Yes      | Unique identifier of the point to be minted                 |
| `amt`    | Yes      | Amount of points to mint                                   |
| `to`     | Yes      | Address of the recipient receiving the minted points       |

### Burn Points
```json
{
  "p": "hcs-20",
  "op": "burn",
  "tick": "unique_point_identifier",
  "amt": "number_of_points",
  "from": "holder_hedera_address"
}
```
**Attributes Table:**

| Key      | Required | Description                                                 |
|----------|----------|-------------------------------------------------------------|
| `p`      | Yes      | Protocol identifier, specifies HCS-20                        |
| `op`     | Yes      | Operation type, here it's 'burn'                             |
| `tick`   | Yes      | Unique identifier of the point to be burned                  |
| `amt`    | Yes      | Amount of points to burn                                    |
| `from`   | Yes      | Address of the holder from whom points are being burned     |

### Transfer Points
```json
{
  "p": "hcs-20",
  "op": "transfer",
  "tick": "unique_point_identifier",
  "amt": "number_of_points",
  "from": "sender_hedera_address",
  "to": "recipient_hedera_address"
}
```
**Attributes Table:**

| Key      | Required | Description                                                  |
|----------|----------|--------------------------------------------------------------|
| `p`      | Yes      | Protocol identifier, specifies HCS-20                         |
| `op`     | Yes      | Operation type, here it's 'transfer'                          |
| `tick`   | Yes      | Unique identifier of the point to be transferred              |
| `amt`    | Yes      | Amount of points to transfer                                 |
| `from`   | Yes      | Address of the sender                                        |
| `to`     | Yes      | Address of the recipient                                     |

Each of these tables provides a clear breakdown of the key attributes necessary for the respective operations in the HCS-20 standard, along with whether they are required and a brief description of their purpose.