# VirtuPlug: Decentralized Plugin Marketplace with Adaptive Trials

## Overview

**VirtuPlug** is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It creates a decentralized marketplace for vendors to sell plugins—modular software extensions, IoT device integrations, or hardware add-ons (e.g., smart home modules, app customizations). The platform uniquely addresses real-world e-commerce pain points: high return rates (up to 30% in software/hardware sales due to poor fit) and buyer dissatisfaction from untested purchases.

### Real-World Problems Solved
- **Buyer Regret and Returns**: Traditional marketplaces lack easy testing, leading to costly returns. VirtuPlug enables **virtual trials** (blockchain-simulated demos via oracles) and **in-person implementations** (geo-verified physical demos), reducing returns by allowing tailored previews.
- **Vendor Trust Issues**: Decentralized complaint handling with transparent resolutions builds accountability without centralized arbitration.
- **Fragmented Markets**: Plugins often span ecosystems (e.g., Web2 apps to Web3 wallets); VirtuPlug standardizes listings with cross-chain compatibility via Stacks' Bitcoin anchoring.
- **Accessibility Barriers**: Low-income or remote users get subsidized trials through DAO governance, promoting equitable access to tech innovations.

By tokenizing trials and complaints, VirtuPlug fosters a self-regulating economy where user feedback directly influences vendor improvements, potentially cutting industry-wide return costs by 20-40% (based on e-commerce benchmarks).

## Key Features
- **Plugin Listings**: Vendors deploy NFTs for plugins with metadata (specs, compatibility).
- **Adaptive Trials**: Users initiate virtual simulations (e.g., oracle-fed API mocks) or book in-person demos (via geolocation proofs).
- **Complaint Tailoring**: AI-prompted (off-chain) complaint logs trigger automated refunds/escalations.
- **Tokenomics**: $VPLUG governance token for staking, voting on trial subsidies, and fee shares.
- **Security**: All transactions anchored to Bitcoin for immutability.

## Architecture
The project uses 7 Clarity smart contracts for modularity and security. Each is audited-friendly with clear access controls (e.g., traits for roles). Contracts interact via cross-contract calls.

### Smart Contracts (5-7 Core)
1. **Marketplace Core (`marketplace.clar`)**: Handles plugin listings, purchases, and NFT minting. Functions: `list-plugin`, `buy-plugin`, `transfer-ownership`. Solves: Centralized listing monopolies.
   
2. **Escrow Vault (`escrow-vault.clar`)**: Manages payments in STX/sIP (SIP-010 tokens) with timed releases post-trial. Functions: `deposit`, `release-on-success`, `refund-on-fail`. Solves: Fraudulent sales via escrowed funds.

3. **Complaint Registry (`complaint-registry.clar`)**: Logs user complaints as on-chain events with metadata (issue type, evidence hash). Functions: `file-complaint`, `resolve-complaint`. Integrates with oracles for verification. Solves: Ignored feedback loops.

4. **Virtual Trial Engine (`virtual-trial.clar`)**: Coordinates oracle calls (e.g., Chainlink on Stacks) for simulated trials. Functions: `request-trial`, `validate-outcome`. Returns trial NFTs for proof. Solves: No-preview purchases.

5. **InPerson Scheduler (`inperson-scheduler.clar`)**: Books physical demos using geohash proofs (via user wallets). Functions: `schedule-demo`, `confirm-attendance`. Rewards verifiers with tokens. Solves: Logistics for hands-on testing.

6. **Dispute Resolver (`dispute-resolver.clar`)**: DAO-voted arbitration for escalated complaints. Functions: `raise-dispute`, `vote-resolution`. Uses quadratic voting for fairness. Solves: Unresolved conflicts.

7. **Governance DAO (`governance-dao.clar`)**: Manages $VPLUG staking and proposals (e.g., trial subsidies). Functions: `propose`, `vote`, `execute`. Solves: Static platform rules via community control.

**Interdependencies**:
- Marketplace calls Escrow for payments.
- Complaints trigger Trials/Scheduler.
- Resolver pulls from Registry; DAO oversees all.

Full contract code is in `/contracts/` directory. Deploy via Clarinet.

## Tech Stack
- **Blockchain**: Stacks (Clarity 1.0+).
- **Frontend**: React + stacks.js for wallet integration (Hiro Wallet).
- **Off-Chain**: Oracles (e.g., Stacks Oracles) for trials; IPFS for plugin metadata.
- **Testing**: Clarinet for unit/integration tests.
- **Deployment**: Mainnet via Hiro CLI.

## Installation & Setup
1. **Prerequisites**:
   - Node.js 18+, Yarn/NPM.
   - Clarinet CLI: `cargo install clarinet`.
   - Hiro Wallet for testing.

2. **Clone & Install**:
   ```
   git clone `git clone <repo-url>`
   cd virtuplug
   yarn install  # or npm install
   ```

3. **Development**:
   - Run local Stacks node: `clarinet integrate`.
   - Compile contracts: `clarinet check`.
   - Deploy to devnet: `clarinet deploy --network devnet`.

4. **Run Frontend**:
   ```
   yarn start
   ```
   Access at `http://localhost:3000`. Connect wallet to test listings.

## Usage Guide
### As a Vendor
1. Deploy plugin NFT via Marketplace: Call `list-plugin` with metadata (JSON on IPFS).
2. Set trial options: Enable virtual (`virtual-trial.request-trial`) or in-person (`inperson-scheduler.schedule-demo`).

### As a Buyer
1. Browse listings on frontend.
2. Initiate trial: Pay escrow fee; receive simulation results or demo booking.
3. File complaint if needed: `complaint-registry.file-complaint` – auto-triggers refund if unresolved.

### Governance
- Stake $VPLUG to vote on proposals (e.g., subsidize trials for low-stake users).

## Tokenomics
- **$VPLUG**: ERC-20 like (SIP-010) for fees (2% marketplace cut), staking rewards.
- Supply: 100M total (20% liquidity, 30% DAO, 50% ecosystem).
- Utilities: Trial access, dispute votes, vendor boosts.

## Roadmap
- **Q4 2025**: Testnet launch, 5 pilot vendors.
- **Q1 2026**: Mainnet, oracle integrations.
- **Q2 2026**: Mobile app, cross-chain bridges (e.g., to Ethereum plugins).

## Contributing
Fork the repo, create a feature branch, and submit a PR. Focus on contract security (use traits, avoid reentrancy). Run tests: `clarinet test`.

## License
MIT License. See [LICENSE](LICENSE) for details.
