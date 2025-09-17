import { describe, it, expect, beforeEach } from "vitest";
import { 
  stringAsciiCV, 
  uintCV, 
  boolCV, 
  principalCV, 
  noneCV, 
  someCV, 
  standardPrincipalCV 
} from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_PLUGIN_ID = 101;
const ERR_INVALID_METADATA = 102;
const ERR_INVALID_PRICE = 103;
const ERR_TRIAL_NOT_ENABLED = 104;
const ERR_ESCROW_FAILED = 105;
const ERR_TRANSFER_FAILED = 106;
const ERR_PLUGIN_NOT_FOUND = 107;
const ERR_INVALID_TRIAL_OPTION = 108;
const ERR_INSUFFICIENT_FEE = 109;
const ERR_OWNERSHIP_TRANSFER = 110;
const ERR_INVALID_STATUS = 111;
const ERR_MAX_LISTINGS = 112;
const ERR_INVALID_COMPATIBILITY = 113;
const ERR_UNSUPPORTED_CURRENCY = 114;
const ERR_FEE_NOT_PAID = 115;

type Response<T> = { ok: boolean; value: T | number };

interface Plugin {
  vendor: string;
  price: bigint;
  metadataUri: string;
  compatibility: string;
  trialEnabled: boolean;
  trialOption: string;
  currency: string;
  status: string;
  createdAt: bigint;
  updatedAt: bigint;
}

interface Ownership {
  owner: string;
  purchasedAt: bigint;
}

interface TrialRequest {
  requestedAt: bigint;
  status: string;
  trialResult?: boolean | null;
}

class MarketplaceMock {
  state: {
    nextPluginId: bigint;
    maxListings: bigint;
    platformFeeBasis: bigint;
    escrowContract: string | null;
    governanceContract: string | null;
    plugins: Map<bigint, Plugin>;
    pluginOwnership: Map<bigint, Ownership>;
    listingsByVendor: Map<string, bigint[]>;
    vendorListingsCount: Map<string, bigint>;
    trialRequests: Map<string, TrialRequest>;
  } = {
    nextPluginId: BigInt(0),
    maxListings: BigInt(500),
    platformFeeBasis: BigInt(200),
    escrowContract: null,
    governanceContract: null,
    plugins: new Map(),
    pluginOwnership: new Map(),
    listingsByVendor: new Map(),
    vendorListingsCount: new Map(),
    trialRequests: new Map(),
  };

  blockHeight: bigint = BigInt(0);
  caller: string = "ST1TEST";
  authorizedVendors: Set<string> = new Set(["ST1TEST", "ST2VENDOR"]);

  stxTransfers: Array<{ amount: bigint; from: string; to: string }> = [];
  escrowDeposits: Array<{ pluginId: bigint; amount: bigint; buyer: string; escrow: string }> = [];
  escrowReleases: Array<{ pluginId: bigint; buyer: string; escrow: string }> = [];
  nftMints: Array<{ recipient: string; id: bigint }> = [];
  nftTransfers: Array<{ from: string; to: string; id: bigint }> = [];
  nftBurns: Array<{ id: bigint; owner: string }> = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.state = {
      nextPluginId: BigInt(0),
      maxListings: BigInt(500),
      platformFeeBasis: BigInt(200),
      escrowContract: null,
      governanceContract: null,
      plugins: new Map(),
      pluginOwnership: new Map(),
      listingsByVendor: new Map(),
      vendorListingsCount: new Map(),
      trialRequests: new Map(),
    };
    this.blockHeight = BigInt(0);
    this.caller = "ST1TEST";
    this.authorizedVendors = new Set(["ST1TEST", "ST2VENDOR"]);
    this.stxTransfers = [];
    this.escrowDeposits = [];
    this.escrowReleases = [];
    this.nftMints = [];
    this.nftTransfers = [];
    this.nftBurns = [];
  }

  isAuthorizedVendor(vendor: string): boolean {
    return this.authorizedVendors.has(vendor);
  }

  setEscrowContract(contractPrincipal: string): Response<boolean> {
    if (!this.isAuthorizedVendor(this.caller)) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.escrowContract !== null) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.escrowContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setGovernanceContract(contractPrincipal: string): Response<boolean> {
    if (!this.isAuthorizedVendor(this.caller)) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.governanceContract !== null) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.governanceContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setPlatformFee(feeBasis: bigint): Response<boolean> {
    if (!this.isAuthorizedVendor(this.caller)) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (feeBasis > BigInt(1000)) return { ok: false, value: ERR_INSUFFICIENT_FEE };
    this.state.platformFeeBasis = feeBasis;
    return { ok: true, value: true };
  }

  listPlugin(
    metadataUri: string,
    price: bigint,
    compatibility: string,
    trialEnabled: boolean,
    trialOption: string,
    currency: string
  ): Response<bigint> {
    if (this.state.nextPluginId >= this.state.maxListings) return { ok: false, value: ERR_MAX_LISTINGS };
    if (metadataUri.length < 10 || metadataUri.length > 256) return { ok: false, value: ERR_INVALID_METADATA };
    if (price <= BigInt(0)) return { ok: false, value: ERR_INVALID_PRICE };
    if (!["stacks", "bitcoin", "ethereum", "web2"].includes(compatibility)) return { ok: false, value: ERR_INVALID_COMPATIBILITY };
    if (trialEnabled && !["virtual", "inperson", "none"].includes(trialOption)) return { ok: false, value: ERR_INVALID_TRIAL_OPTION };
    if (!["STX", "sBTC", "sIP"].includes(currency)) return { ok: false, value: ERR_UNSUPPORTED_CURRENCY };
    if (!this.isAuthorizedVendor(this.caller)) return { ok: false, value: ERR_NOT_AUTHORIZED };

    this.nftMints.push({ recipient: this.caller, id: this.state.nextPluginId });

    const id = this.state.nextPluginId;
    const plugin: Plugin = {
      vendor: this.caller,
      price,
      metadataUri,
      compatibility,
      trialEnabled,
      trialOption,
      currency,
      status: "active",
      createdAt: this.blockHeight,
      updatedAt: this.blockHeight,
    };
    this.state.plugins.set(id, plugin);
    this.state.pluginOwnership.set(id, { owner: this.caller, purchasedAt: this.blockHeight });

    if (!this.state.listingsByVendor.has(this.caller)) {
      this.state.listingsByVendor.set(this.caller, []);
    }
    const vendorList = this.state.listingsByVendor.get(this.caller)!;
    vendorList.push(id);
    this.state.listingsByVendor.set(this.caller, vendorList);

    if (!this.state.vendorListingsCount.has(this.caller)) {
      this.state.vendorListingsCount.set(this.caller, BigInt(0));
    }
    this.state.vendorListingsCount.set(this.caller, this.state.vendorListingsCount.get(this.caller)! + BigInt(1));

    this.state.nextPluginId += BigInt(1);
    return { ok: true, value: id };
  }

  purchasePlugin(pluginId: bigint): Response<boolean> {
    const plugin = this.state.plugins.get(pluginId);
    if (!plugin) return { ok: false, value: ERR_PLUGIN_NOT_FOUND };
    if (plugin.status !== "active") return { ok: false, value: ERR_INVALID_STATUS };
    if (plugin.trialEnabled) return { ok: false, value: ERR_TRIAL_NOT_ENABLED };
    if (plugin.vendor === this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };

    const escrow = this.state.escrowContract;
    if (!escrow) return { ok: false, value: ERR_ESCROW_FAILED };

    const feeAmount = (plugin.price * this.state.platformFeeBasis) / BigInt(10000);
    this.stxTransfers.push({ amount: feeAmount, from: this.caller, to: this.state.governanceContract || "" });

    this.escrowDeposits.push({ pluginId, amount: plugin.price, buyer: this.caller, escrow });

    this.state.pluginOwnership.set(pluginId, { owner: this.caller, purchasedAt: this.blockHeight });
    this.state.plugins.set(pluginId, { ...plugin, status: "sold", updatedAt: this.blockHeight });

    this.nftTransfers.push({ from: plugin.vendor, to: this.caller, id: pluginId });

    return { ok: true, value: true };
  }

  requestTrial(pluginId: bigint): Response<boolean> {
    const plugin = this.state.plugins.get(pluginId);
    if (!plugin) return { ok: false, value: ERR_PLUGIN_NOT_FOUND };
    if (!plugin.trialEnabled) return { ok: false, value: ERR_TRIAL_NOT_ENABLED };
    if (plugin.status !== "active") return { ok: false, value: ERR_INVALID_STATUS };

    const key = `${pluginId}-${this.caller}`;
    this.state.trialRequests.set(key, {
      requestedAt: this.blockHeight,
      status: "pending",
      trialResult: undefined,
    });

    return { ok: true, value: true };
  }

  completeTrial(pluginId: bigint, buyer: string, success: boolean): Response<boolean> {
    if (!this.isAuthorizedVendor(this.caller)) return { ok: false, value: ERR_NOT_AUTHORIZED };

    const key = `${pluginId}-${buyer}`;
    const request = this.state.trialRequests.get(key);
    if (!request) return { ok: false, value: ERR_PLUGIN_NOT_FOUND };
    if (request.status !== "pending") return { ok: false, value: ERR_INVALID_STATUS };

    this.state.trialRequests.set(key, { ...request, status: "completed", trialResult: success });

    if (success) {
      return this.purchasePluginAfterTrial(pluginId, buyer);
    }

    return { ok: true, value: false };
  }

  private purchasePluginAfterTrial(pluginId: bigint, buyer: string): Response<boolean> {
    const plugin = this.state.plugins.get(pluginId);
    if (!plugin) return { ok: false, value: ERR_PLUGIN_NOT_FOUND };

    const escrow = this.state.escrowContract;
    if (!escrow) return { ok: false, value: ERR_ESCROW_FAILED };

    const feeAmount = (plugin.price * this.state.platformFeeBasis) / BigInt(10000);
    this.stxTransfers.push({ amount: feeAmount, from: buyer, to: this.state.governanceContract || "" });

    this.escrowReleases.push({ pluginId, buyer, escrow });

    this.state.pluginOwnership.set(pluginId, { owner: buyer, purchasedAt: this.blockHeight });
    this.state.plugins.set(pluginId, { ...plugin, status: "sold", updatedAt: this.blockHeight });

    this.nftTransfers.push({ from: plugin.vendor, to: buyer, id: pluginId });

    return { ok: true, value: true };
  }

  updateListing(
    pluginId: bigint,
    newPrice?: bigint,
    newMetadata?: string,
    newStatus?: string
  ): Response<boolean> {
    const plugin = this.state.plugins.get(pluginId);
    if (!plugin) return { ok: false, value: ERR_PLUGIN_NOT_FOUND };
    if (plugin.vendor !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (plugin.status !== "active") return { ok: false, value: ERR_INVALID_STATUS };

    if (newPrice !== undefined && newPrice <= BigInt(0)) return { ok: false, value: ERR_INVALID_PRICE };
    if (newMetadata !== undefined && (newMetadata.length < 10 || newMetadata.length > 256)) return { ok: false, value: ERR_INVALID_METADATA };
    if (newStatus !== undefined && !["active", "sold", "delisted"].includes(newStatus)) return { ok: false, value: ERR_INVALID_STATUS };

    const updated: Plugin = {
      ...plugin,
      price: newPrice ?? plugin.price,
      metadataUri: newMetadata ?? plugin.metadataUri,
      status: newStatus ?? plugin.status,
      updatedAt: this.blockHeight,
    };
    this.state.plugins.set(pluginId, updated);
    return { ok: true, value: true };
  }

  delistPlugin(pluginId: bigint): Response<boolean> {
    const plugin = this.state.plugins.get(pluginId);
    if (!plugin) return { ok: false, value: ERR_PLUGIN_NOT_FOUND };
    if (plugin.vendor !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (plugin.status !== "active") return { ok: false, value: ERR_INVALID_STATUS };

    this.nftBurns.push({ id: pluginId, owner: this.caller });
    this.state.plugins.delete(pluginId);
    this.state.pluginOwnership.delete(pluginId);

    const key = `${pluginId}-${this.caller}`;
    this.state.trialRequests.delete(key);

    const vendorList = this.state.listingsByVendor.get(this.caller) || [];
    const newList = vendorList.filter(id => id !== pluginId);
    this.state.listingsByVendor.set(this.caller, newList);
    this.state.vendorListingsCount.set(this.caller, BigInt(newList.length));

    return { ok: true, value: true };
  }

  getPlugin(pluginId: bigint): Plugin | null {
    return this.state.plugins.get(pluginId) || null;
  }

  getOwnership(pluginId: bigint): Ownership | null {
    return this.state.pluginOwnership.get(pluginId) || null;
  }

  getTrialRequest(pluginId: bigint, buyer: string): TrialRequest | null {
    const key = `${pluginId}-${buyer}`;
    return this.state.trialRequests.get(key) || null;
  }

  getNextPluginId(): Response<bigint> {
    return { ok: true, value: this.state.nextPluginId };
  }

  getPlatformFee(): Response<bigint> {
    return { ok: true, value: this.state.platformFeeBasis };
  }

  getVendorCount(vendor: string): Response<bigint> {
    return { ok: true, value: this.state.vendorListingsCount.get(vendor) || BigInt(0) };
  }
}

describe("Marketplace Core Contract", () => {
  let marketplace: MarketplaceMock;

  beforeEach(() => {
    marketplace = new MarketplaceMock();
    marketplace.reset();
    marketplace.setEscrowContract("ST2ESCROW");
    marketplace.setGovernanceContract("ST2GOV");
  });

  it("lists a plugin successfully", () => {
    marketplace.caller = "ST2VENDOR";
    const result = marketplace.listPlugin(
      "ipfs://QmExampleMetadata",
      BigInt(1000),
      "stacks",
      true,
      "virtual",
      "STX"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(BigInt(0));

    const plugin = marketplace.getPlugin(BigInt(0));
    expect(plugin?.vendor).toBe("ST2VENDOR");
    expect(plugin?.price).toBe(BigInt(1000));
    expect(plugin?.metadataUri).toBe("ipfs://QmExampleMetadata");
    expect(plugin?.compatibility).toBe("stacks");
    expect(plugin?.trialEnabled).toBe(true);
    expect(plugin?.trialOption).toBe("virtual");
    expect(plugin?.currency).toBe("STX");
    expect(plugin?.status).toBe("active");

    const ownership = marketplace.getOwnership(BigInt(0));
    expect(ownership?.owner).toBe("ST2VENDOR");

    const vendorList = marketplace.state.listingsByVendor.get("ST2VENDOR");
    expect(vendorList).toEqual([BigInt(0)]);
    expect(marketplace.state.vendorListingsCount.get("ST2VENDOR")).toBe(BigInt(1));

    expect(marketplace.nftMints).toEqual([{ recipient: "ST2VENDOR", id: BigInt(0) }]);
  });

  it("rejects duplicate plugin id", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmExampleMetadata",
      BigInt(1000),
      "stacks",
      true,
      "virtual",
      "STX"
    );
    const result = marketplace.listPlugin(
      "ipfs://QmAnotherMetadata",
      BigInt(2000),
      "bitcoin",
      false,
      "none",
      "sBTC"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(BigInt(1));
    expect(marketplace.getPlugin(BigInt(1))?.metadataUri).toBe("ipfs://QmAnotherMetadata");
  });

  it("rejects invalid price", () => {
    marketplace.caller = "ST2VENDOR";
    const result = marketplace.listPlugin(
      "ipfs://QmExample",
      BigInt(0),
      "stacks",
      false,
      "none",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PRICE);
  });

  it("rejects invalid metadata length", () => {
    marketplace.caller = "ST2VENDOR";
    const result = marketplace.listPlugin(
      "short",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_METADATA);
  });

  it("rejects invalid trial option", () => {
    marketplace.caller = "ST2VENDOR";
    const result = marketplace.listPlugin(
      "ipfs://QmValid",
      BigInt(1000),
      "stacks",
      true,
      "invalid",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TRIAL_OPTION);
  });

  it("buys a plugin successfully", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    marketplace.caller = "ST1BUYER";
    const result = marketplace.purchasePlugin(BigInt(0));
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const plugin = marketplace.getPlugin(BigInt(0));
    expect(plugin?.status).toBe("sold");

    const ownership = marketplace.getOwnership(BigInt(0));
    expect(ownership?.owner).toBe("ST1BUYER");

    expect(marketplace.stxTransfers).toEqual([{ amount: BigInt(20), from: "ST1BUYER", to: "ST2GOV" }]);
    expect(marketplace.escrowDeposits).toEqual([{ pluginId: BigInt(0), amount: BigInt(1000), buyer: "ST1BUYER", escrow: "ST2ESCROW" }]);
    expect(marketplace.nftTransfers).toEqual([{ from: "ST2VENDOR", to: "ST1BUYER", id: BigInt(0) }]);
  });

  it("rejects buy non-active plugin", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    marketplace.caller = "ST1BUYER";
    marketplace.purchasePlugin(BigInt(0));
    const result = marketplace.purchasePlugin(BigInt(0));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_STATUS);
  });

  it("rejects buy without trial enabled", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      true,
      "virtual",
      "STX"
    );
    marketplace.caller = "ST1BUYER";
    const result = marketplace.purchasePlugin(BigInt(0));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_TRIAL_NOT_ENABLED);
  });

  it("rejects buy non-existent plugin", () => {
    marketplace.caller = "ST1BUYER";
    const result = marketplace.purchasePlugin(BigInt(999));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PLUGIN_NOT_FOUND);
  });

  it("transfers ownership successfully", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    marketplace.caller = "ST1BUYER";
    marketplace.purchasePlugin(BigInt(0));
    const ownership = marketplace.getOwnership(BigInt(0));
    expect(ownership?.owner).toBe("ST1BUYER");
    expect(marketplace.nftTransfers).toContainEqual({ from: "ST2VENDOR", to: "ST1BUYER", id: BigInt(0) });
  });

  it("rejects transfer by non-owner", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    marketplace.caller = "ST1BUYER";
    marketplace.purchasePlugin(BigInt(0));
    marketplace.caller = "ST3UNAUTHORIZED";
    const result = marketplace.purchasePlugin(BigInt(0));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_STATUS);
  });

  it("rejects transfer invalid owner", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    marketplace.caller = "ST1BUYER";
    marketplace.purchasePlugin(BigInt(0));
    marketplace.caller = "ST3UNAUTHORIZED";
    const result = marketplace.updateListing(BigInt(0), BigInt(2000));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("updates listing successfully", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmOld",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    const result = marketplace.updateListing(BigInt(0), BigInt(2000), "ipfs://QmNew");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const plugin = marketplace.getPlugin(BigInt(0));
    expect(plugin?.price).toBe(BigInt(2000));
    expect(plugin?.metadataUri).toBe("ipfs://QmNew");
    expect(plugin?.updatedAt).toBe(marketplace.blockHeight);
  });

  it("rejects update non-existent listing", () => {
    marketplace.caller = "ST2VENDOR";
    const result = marketplace.updateListing(BigInt(999), BigInt(2000));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PLUGIN_NOT_FOUND);
  });

  it("rejects update by non-vendor", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    marketplace.caller = "ST1BUYER";
    const result = marketplace.updateListing(BigInt(0), BigInt(2000));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects update invalid price", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    const result = marketplace.updateListing(BigInt(0), BigInt(0));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PRICE);
  });

  it("delists plugin successfully", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    const result = marketplace.delistPlugin(BigInt(0));
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    expect(marketplace.getPlugin(BigInt(0))).toBeNull();
    expect(marketplace.getOwnership(BigInt(0))).toBeNull();
    expect(marketplace.state.vendorListingsCount.get("ST2VENDOR")).toBe(BigInt(0));
    expect(marketplace.nftBurns).toEqual([{ id: BigInt(0), owner: "ST2VENDOR" }]);
  });

  it("rejects delist non-existent plugin", () => {
    marketplace.caller = "ST2VENDOR";
    const result = marketplace.delistPlugin(BigInt(999));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PLUGIN_NOT_FOUND);
  });

  it("rejects delist by non-vendor", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    marketplace.caller = "ST1BUYER";
    const result = marketplace.delistPlugin(BigInt(0));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets platform fee successfully", () => {
    marketplace.caller = "ST2VENDOR";
    const result = marketplace.setPlatformFee(BigInt(300));
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(marketplace.state.platformFeeBasis).toBe(BigInt(300));
  });

  it("rejects platform fee without registry", () => {
    marketplace.caller = "ST3UNAUTHORIZED";
    marketplace.authorizedVendors = new Set([]);
    const result = marketplace.setPlatformFee(BigInt(300));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid platform fee", () => {
    marketplace.caller = "ST2VENDOR";
    const result = marketplace.setPlatformFee(BigInt(1001));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_FEE);
  });

  it("returns next plugin id", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    const result = marketplace.getNextPluginId();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(BigInt(1));
  });

  it("returns platform fee", () => {
    const result = marketplace.getPlatformFee();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(BigInt(200));
  });

  it("returns vendor count", () => {
    marketplace.caller = "ST2VENDOR";
    marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    const result = marketplace.getVendorCount("ST2VENDOR");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(BigInt(1));
  });

  it("rejects list plugin without registry", () => {
    marketplace.caller = "ST3UNAUTHORIZED";
    marketplace.authorizedVendors = new Set([]);
    const result = marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid vendor", () => {
    marketplace.caller = "ST3UNAUTHORIZED";
    marketplace.authorizedVendors = new Set(["ST2VENDOR"]);
    const result = marketplace.listPlugin(
      "ipfs://QmPlugin",
      BigInt(1000),
      "stacks",
      false,
      "none",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });
});