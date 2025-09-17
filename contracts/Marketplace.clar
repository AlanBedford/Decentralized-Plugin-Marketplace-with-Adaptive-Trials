;; contracts/marketplace.clar

(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)
(impl-trait .marketplace-trait.marketplace-trait)

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PLUGIN-ID u101)
(define-constant ERR-INVALID-METADATA u102)
(define-constant ERR-INVALID-PRICE u103)
(define-constant ERR-TRIAL-NOT-ENABLED u104)
(define-constant ERR-ESCROW-FAILED u105)
(define-constant ERR-TRANSFER-FAILED u106)
(define-constant ERR-PLUGIN-NOT-FOUND u107)
(define-constant ERR-INVALID-TRIAL-OPTION u108)
(define-constant ERR-INSUFFICIENT-FEE u109)
(define-constant ERR-OWNERSHIP-TRANSFER u110)
(define-constant ERR-INVALID-STATUS u111)
(define-constant ERR-MAX-LISTINGS u112)
(define-constant ERR-INVALID-COMPATIBILITY u113)
(define-constant ERR-UNSUPPORTED-CURRENCY u114)
(define-constant ERR-FEE-NOT-PAID u115)

(define-data-var next-plugin-id uint u0)
(define-data-var max-listings uint u500)
(define-data-var platform-fee-basis uint u200)
(define-data-var escrow-contract (optional principal) none)
(define-data-var governance-contract (optional principal) none)

(define-non-fungible-token plugin-nft uint)

(define-map plugins
  uint
  {
    vendor: principal,
    price: uint,
    metadata-uri: (string-ascii 256),
    compatibility: (string-ascii 100),
    trial-enabled: bool,
    trial-option: (string-ascii 50),
    currency: (string-ascii 10),
    status: (string-ascii 20),
    created-at: uint,
    updated-at: uint
  }
)

(define-map plugin-ownership
  uint
  {
    owner: principal,
    purchased-at: uint
  }
)

(define-map listings-by-vendor
  principal
  (list 100 uint)
)

(define-map vendor-listings-count
  principal
  uint
)

(define-map trial-requests
  { plugin-id: uint, buyer: principal }
  {
    requested-at: uint,
    status: (string-ascii 20),
    trial-result: (optional bool)
  }
)

(define-read-only (get-plugin (id uint))
  (map-get? plugins id)
)

(define-read-only (get-ownership (id uint))
  (map-get? plugin-ownership id)
)

(define-read-only (get-trial-request (plugin-id uint) (buyer principal))
  (map-get? trial-requests { plugin-id: plugin-id, buyer: buyer })
)

(define-read-only (is-vendor-authorized (vendor principal))
  (contract-call? .governance-dao is-authorized-vendor vendor)
)

(define-read-only (get-vendor-listings (vendor principal))
  (map-get? listings-by-vendor vendor)
)

(define-read-only (get-vendor-count (vendor principal))
  (map-get? vendor-listings-count vendor)
)

(define-private (validate-metadata (uri (string-ascii 256)))
  (if (and (> (len uri) u10) (<= (len uri) u256))
      (ok true)
      (err ERR-INVALID-METADATA))
)

(define-private (validate-price (price uint))
  (if (> price u0)
      (ok true)
      (err ERR-INVALID-PRICE))
)

(define-private (validate-compatibility (compat (string-ascii 100)))
  (if (or (is-eq compat "stacks") (is-eq compat "bitcoin") (is-eq compat "ethereum") (is-eq compat "web2"))
      (ok true)
      (err ERR-INVALID-COMPATIBILITY))
)

(define-private (validate-trial-option (option (string-ascii 50)))
  (if (or (is-eq option "virtual") (is-eq option "inperson") (is-eq option "none"))
      (ok true)
      (err ERR-INVALID-TRIAL-OPTION))
)

(define-private (validate-currency (cur (string-ascii 10)))
  (if (or (is-eq cur "STX") (is-eq cur "sBTC") (is-eq cur "sIP"))
      (ok true)
      (err ERR-UNSUPPORTED-CURRENCY))
)

(define-private (validate-status (status (string-ascii 20)))
  (if (or (is-eq status "active") (is-eq status "sold") (is-eq status "delisted"))
      (ok true)
      (err ERR-INVALID-STATUS))
)

(define-private (add-to-vendor-list (vendor principal) (id uint))
  (let ((current-list (unwrap! (map-get? listings-by-vendor vendor) (list )))
        (new-list (append current-list id)))
    (map-set listings-by-vendor vendor new-list)
    (map-set vendor-listings-count vendor (+ (default-to u0 (map-get? vendor-listings-count vendor)) u1))
    (ok true))
)

(define-private (remove-from-vendor-list (vendor principal) (id uint))
  (let ((current-list (unwrap! (map-get? listings-by-vendor vendor) (list )))
        (new-list (fold remove-id current-list id)))
    (map-set listings-by-vendor vendor new-list)
    (map-set vendor-listings-count vendor (- (default-to u1 (map-get? vendor-listings-count vendor)) u1))
    (ok true))
  (where (define-private (remove-id (current uint) (target uint))
           (if (is-eq current target)
               (list )
               (list current))))
)

(define-public (set-escrow-contract (contract-principal principal))
  (begin
    (asserts! (is-vendor-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-none (var-get escrow-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set escrow-contract (some contract-principal))
    (ok true))
)

(define-public (set-governance-contract (contract-principal principal))
  (begin
    (asserts! (is-vendor-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-none (var-get governance-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set governance-contract (some contract-principal))
    (ok true))
)

(define-public (set-platform-fee (fee-basis uint))
  (begin
    (asserts! (is-vendor-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= fee-basis u1000) (err ERR-INVALID-FEE))
    (var-set platform-fee-basis fee-basis)
    (ok true))
)

(define-public (list-plugin
  (metadata-uri (string-ascii 256))
  (price uint)
  (compatibility (string-ascii 100))
  (trial-enabled bool)
  (trial-option (string-ascii 50))
  (currency (string-ascii 10))
)
  (let ((next-id (var-get next-plugin-id))
        (current-max (var-get max-listings)))
    (asserts! (< next-id current-max) (err ERR-MAX-LISTINGS))
    (try! (validate-metadata metadata-uri))
    (try! (validate-price price))
    (try! (validate-compatibility compatibility))
    (if trial-enabled
        (try! (validate-trial-option trial-option))
        (ok true))
    (try! (validate-currency currency))
    (asserts! (is-vendor-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (contract-call? .plugin-nft mint tx-sender next-id))
    (map-set plugins next-id
      {
        vendor: tx-sender,
        price: price,
        metadata-uri: metadata-uri,
        compatibility: compatibility,
        trial-enabled: trial-enabled,
        trial-option: trial-option,
        currency: currency,
        status: "active",
        created-at: block-height,
        updated-at: block-height
      }
    )
    (map-set plugin-ownership next-id
      {
        owner: tx-sender,
        purchased-at: block-height
      }
    )
    (try! (add-to-vendor-list tx-sender next-id))
    (var-set next-plugin-id (+ next-id u1))
    (print { event: "plugin-listed", id: next-id, vendor: tx-sender })
    (ok next-id))
)

(define-public (purchase-plugin (plugin-id uint))
  (let ((plugin (unwrap! (map-get? plugins plugin-id) (err ERR-PLUGIN-NOT-FOUND)))
        (escrow (unwrap! (var-get escrow-contract) (err ERR-ESCROW-FAILED))))
    (asserts! (is-eq (get status plugin) "active") (err ERR-INVALID-STATUS))
    (asserts! (not (get trial-enabled plugin)) (err ERR-TRIAL-NOT-ENABLED))
    (let ((fee-amount (/ (* (get price plugin) (var-get platform-fee-basis)) u10000)))
      (try! (stx-transfer? fee-amount tx-sender .governance-dao))
      (try! (contract-call? .escrow-vault deposit plugin-id (get price plugin) tx-sender escrow))
    )
    (map-set plugin-ownership plugin-id
      {
        owner: tx-sender,
        purchased-at: block-height
      }
    )
    (map-set plugins plugin-id
      {
        vendor: (get vendor plugin),
        price: (get price plugin),
        metadata-uri: (get metadata-uri plugin),
        compatibility: (get compatibility plugin),
        trial-enabled: (get trial-enabled plugin),
        trial-option: (get trial-option plugin),
        currency: (get currency plugin),
        status: "sold",
        created-at: (get created-at plugin),
        updated-at: block-height
      }
    )
    (try! (contract-call? .plugin-nft transfer (get vendor plugin) tx-sender plugin-id))
    (print { event: "plugin.purchased", id: plugin-id, buyer: tx-sender })
    (ok true))
)

(define-public (request-trial (plugin-id uint))
  (let ((plugin (unwrap! (map-get? plugins plugin-id) (err ERR-PLUGIN-NOT-FOUND))))
    (asserts! (get trial-enabled plugin) (err ERR-TRIAL-NOT-ENABLED))
    (asserts! (is-eq (get status plugin) "active") (err ERR-INVALID-STATUS))
    (map-set trial-requests { plugin-id: plugin-id, buyer: tx-sender }
      {
        requested-at: block-height,
        status: "pending",
        trial-result: none
      }
    )
    (print { event: "trial-requested", plugin-id: plugin-id, buyer: tx-sender })
    (ok true))
)

(define-public (complete-trial (plugin-id uint) (buyer principal) (success bool))
  (let ((request (unwrap! (map-get? trial-requests { plugin-id: plugin-id, buyer: buyer }) (err ERR-TRIAL-NOT-FOUND)))
        (plugin (unwrap! (map-get? plugins plugin-id) (err ERR-PLUGIN-NOT-FOUND))))
    (asserts! (is-vendor-authorized tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status request) "pending") (err ERR-INVALID-STATUS))
    (map-set trial-requests { plugin-id: plugin-id, buyer: buyer }
      {
        requested-at: (get requested-at request),
        status: "completed",
        trial-result: (some success)
      }
    )
    (if success
        (begin
          (try! (purchase-plugin-after-trial plugin-id buyer))
          (ok true))
        (begin
          (print { event: "trial-failed", plugin-id: plugin-id, buyer: buyer })
          (ok false)))
  )
)

(define-private (purchase-plugin-after-trial (plugin-id uint) (buyer principal))
  (let ((plugin (unwrap! (map-get? plugins plugin-id) (err ERR-PLUGIN-NOT-FOUND)))
        (escrow (unwrap! (var-get escrow-contract) (err ERR-ESCROW-FAILED))))
    (let ((fee-amount (/ (* (get price plugin) (var-get platform-fee-basis)) u10000)))
      (try! (stx-transfer? fee-amount buyer .governance-dao))
      (try! (contract-call? .escrow-vault release plugin-id buyer escrow))
    )
    (map-set plugin-ownership plugin-id
      {
        owner: buyer,
        purchased-at: block-height
      }
    )
    (map-set plugins plugin-id
      {
        vendor: (get vendor plugin),
        price: (get price plugin),
        metadata-uri: (get metadata-uri plugin),
        compatibility: (get compatibility plugin),
        trial-enabled: (get trial-enabled plugin),
        trial-option: (get trial-option plugin),
        currency: (get currency plugin),
        status: "sold",
        created-at: (get created-at plugin),
        updated-at: block-height
      }
    )
    (try! (contract-call? .plugin-nft transfer (get vendor plugin) buyer plugin-id))
    (print { event: "trial-purchased", id: plugin-id, buyer: buyer })
    (ok true))
)

(define-public (update-listing (plugin-id uint)
  (new-price (optional uint))
  (new-metadata (optional (string-ascii 256)))
  (new-status (optional (string-ascii 20))))
  (let ((plugin (unwrap! (map-get? plugins plugin-id) (err ERR-PLUGIN-NOT-FOUND))))
    (asserts! (is-eq (get vendor plugin) tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status plugin) "active") (err ERR-INVALID-STATUS))
    (match new-price p (try! (validate-price p)) (ok true))
    (match new-metadata m (try! (validate-metadata m)) (ok true))
    (match new-status s (try! (validate-status s)) (ok true))
    (let ((updated-plugin
      {
        vendor: (get vendor plugin),
        price: (match new-price p p (get price plugin)),
        metadata-uri: (match new-metadata m m (get metadata-uri plugin)),
        compatibility: (get compatibility plugin),
        trial-enabled: (get trial-enabled plugin),
        trial-option: (get trial-option plugin),
        currency: (get currency plugin),
        status: (match new-status s s (get status plugin)),
        created-at: (get created-at plugin),
        updated-at: block-height
      }
    ))
      (map-set plugins plugin-id updated-plugin)
      (print { event: "listing-updated", id: plugin-id })
      (ok true))
  )
)

(define-public (delist-plugin (plugin-id uint))
  (let ((plugin (unwrap! (map-get? plugins plugin-id) (err ERR-PLUGIN-NOT-FOUND))))
    (asserts! (is-eq (get vendor plugin) tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status plugin) "active") (err ERR-INVALID-STATUS))
    (try! (contract-call? .plugin-nft burn plugin-id tx-sender))
    (map-delete plugins plugin-id)
    (map-delete plugin-ownership plugin-id)
    (map-delete trial-requests { plugin-id: plugin-id, buyer: tx-sender })
    (try! (remove-from-vendor-list tx-sender plugin-id))
    (print { event: "plugin-delisted", id: plugin-id })
    (ok true))
)

(define-public (get-next-plugin-id)
  (ok (var-get next-plugin-id))
)

(define-public (get-platform-fee)
  (ok (var-get platform-fee-basis))
)