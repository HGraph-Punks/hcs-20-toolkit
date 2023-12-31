<p align="center"><img src="https://i.imgur.com/flcMvDC.png"></p>

## Usage for Hedera Consensus Service ease-of-use

## Purpose
Make a simple tool for users to easily engage with the Hedera Consensus Service. Initial toolkit is focused on creating audiable points for loyalty on HCS

### HCS-20
HCS-20 is a standard proposal for the creation of audiable points on HCS.
Here are the tables with functions and detailed descriptions:

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