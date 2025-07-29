use std::net::SocketAddr;

use chia_protocol::{Handshake, Message, NodeType, ProtocolMessageTypes};
use chia_traits::Streamable;
use tokio::sync::mpsc;
use tokio_tungstenite::Connector;
use tracing::instrument;

use crate::{ClientError, Peer, PeerOptions};

#[instrument(skip(connector))]
pub async fn connect_peer(
    network_id: String,
    connector: Connector,
    socket_addr: SocketAddr,
    options: PeerOptions,
) -> Result<(Peer, mpsc::Receiver<Message>), ClientError> {
    let (peer, mut receiver) = Peer::connect(socket_addr, connector, options).await?;

    peer.send(Handshake {
        network_id: network_id.clone(),
        protocol_version: "0.0.37".to_string(),
        software_version: "0.0.0".to_string(),
        server_port: 0,
        node_type: NodeType::Wallet,
        capabilities: vec![
            (1, "1".to_string()),
            (2, "1".to_string()),
            (3, "1".to_string()),
        ],
    })
    .await?;

    let Some(message) = receiver.recv().await else {
        return Err(ClientError::MissingHandshake);
    };

    if message.msg_type != ProtocolMessageTypes::Handshake {
        return Err(ClientError::InvalidResponse(
            vec![ProtocolMessageTypes::Handshake],
            message.msg_type,
        ));
    }

    let handshake = Handshake::from_bytes(&message.data)?;

    if handshake.node_type != NodeType::FullNode {
        return Err(ClientError::WrongNodeType(
            NodeType::FullNode,
            handshake.node_type,
        ));
    }

    if handshake.network_id != network_id {
        return Err(ClientError::WrongNetwork(
            network_id.to_string(),
            handshake.network_id,
        ));
    }

    Ok((peer, receiver))
}
