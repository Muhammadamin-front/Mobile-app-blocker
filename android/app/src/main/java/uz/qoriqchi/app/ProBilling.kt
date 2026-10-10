package uz.qoriqchi.app

import android.app.Activity
import android.content.Context
import android.content.pm.ApplicationInfo
import android.util.Log
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams

/** What the app knows about Pro right now. */
data class ProStatus(
  val unlocked: Boolean,
  /** Play answered on this phone and offers the product, so Pro can be bought here. */
  val available: Boolean,
  /** Play's own formatted price, in the buyer's currency; null until Play answers. */
  val price: String?,
  /** Paid with a method that settles later; unlocks when Play confirms it. */
  val pending: Boolean,
)

/**
 * The entitlement, stored on the phone. Strict sessions are the paid feature, and the
 * session code asks only this — never Play directly — so a strict session keeps its
 * rules offline, after a reboot, and when the React Native side is gone.
 */
object ProStore {
  const val PRODUCT_ID = "qoriqchi_pro"
  private const val UNLOCKED = "pro_unlocked"
  private const val PURCHASE_TOKEN = "pro_purchase_token"

  fun isUnlocked(context: Context): Boolean =
    runCatching { FocusDatabase.get(context).getSetting(UNLOCKED) == "true" }.getOrDefault(false)

  fun setUnlocked(context: Context, unlocked: Boolean, token: String? = null) {
    val database = FocusDatabase.get(context)
    database.setSetting(UNLOCKED, unlocked.toString())
    database.setSetting(PURCHASE_TOKEN, if (unlocked) token.orEmpty() else "")
  }

  /** Debug builds have no Play listing to buy from, so the purchase is simulated there. */
  fun isDebugBuild(context: Context): Boolean =
    context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
}

/**
 * A thin wrapper over Play Billing for one non-consumable product. Every answer from
 * Play is written to [ProStore] first and reported second, so the stored entitlement
 * is always what the last successful conversation with Play said — including a refund,
 * which shows up as the purchase no longer being returned.
 */
class ProBilling(context: Context) : PurchasesUpdatedListener {
  private val appContext = context.applicationContext
  private val client: BillingClient = BillingClient.newBuilder(appContext)
    .setListener(this)
    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
    .build()

  @Volatile private var product: ProductDetails? = null
  @Volatile private var available = false
  @Volatile private var pending = false
  private var purchaseCallback: ((Result<ProStatus>) -> Unit)? = null

  fun status(): ProStatus = ProStatus(
    unlocked = ProStore.isUnlocked(appContext),
    // Billing alone is not enough: before the product exists in Play Console (or in a
    // sideloaded build), Play answers but has nothing to sell.
    available = (available && product != null) || ProStore.isDebugBuild(appContext),
    price = product?.oneTimePurchaseOfferDetails?.formattedPrice,
    pending = pending,
  )

  /** Connects if needed, then re-reads both the price and what this account owns. */
  fun refresh(callback: (ProStatus) -> Unit) {
    connect { ready ->
      if (!ready) {
        callback(status())
        return@connect
      }
      queryProduct {
        queryOwned { callback(status()) }
      }
    }
  }

  fun buy(activity: Activity?, callback: (Result<ProStatus>) -> Unit) {
    if (ProStore.isDebugBuild(appContext) && (!available || product == null)) {
      ProStore.setUnlocked(appContext, true, token = "debug")
      callback(Result.success(status()))
      return
    }
    val details = product
    if (activity == null || details == null || !available) {
      callback(Result.failure(IllegalStateException("Pro can only be bought in the Google Play version of Qoriqchi.")))
      return
    }
    purchaseCallback = callback
    val params = BillingFlowParams.newBuilder()
      .setProductDetailsParamsList(
        listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build()),
      )
      .build()
    val launched = client.launchBillingFlow(activity, params)
    if (launched.responseCode != BillingClient.BillingResponseCode.OK) {
      purchaseCallback = null
      callback(Result.failure(IllegalStateException(describe(launched))))
    }
  }

  override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
    val callback = purchaseCallback
    purchaseCallback = null
    when (result.responseCode) {
      BillingClient.BillingResponseCode.OK -> {
        purchases.orEmpty().forEach(::handle)
        callback?.invoke(Result.success(status()))
      }
      // Closing Play's sheet is a choice, not an error.
      BillingClient.BillingResponseCode.USER_CANCELED -> callback?.invoke(Result.success(status()))
      BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> queryOwned { callback?.invoke(Result.success(status())) }
      else -> callback?.invoke(Result.failure(IllegalStateException(describe(result))))
    }
  }

  private fun handle(purchase: Purchase) {
    if (PRODUCT !in purchase.products) return
    when (purchase.purchaseState) {
      Purchase.PurchaseState.PURCHASED -> {
        pending = false
        ProStore.setUnlocked(appContext, true, purchase.purchaseToken)
        // Play refunds a purchase that is not acknowledged within three days.
        if (!purchase.isAcknowledged) {
          client.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build(),
          ) { ack ->
            if (ack.responseCode != BillingClient.BillingResponseCode.OK) {
              Log.w(TAG, "Acknowledging Pro failed: ${describe(ack)}")
            }
          }
        }
      }
      Purchase.PurchaseState.PENDING -> pending = true
      else -> Unit
    }
  }

  private fun queryOwned(done: () -> Unit) {
    client.queryPurchasesAsync(
      QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
    ) { result, purchases ->
      if (result.responseCode == BillingClient.BillingResponseCode.OK) {
        val owned = purchases.filter { PRODUCT in it.products }
        owned.forEach(::handle)
        pending = owned.any { it.purchaseState == Purchase.PurchaseState.PENDING }
        // Play answered and the purchase is gone: refunded or revoked. A debug unlock
        // is left alone, because Play never knew about it.
        if (owned.none { it.purchaseState == Purchase.PurchaseState.PURCHASED } &&
          !ProStore.isDebugBuild(appContext)
        ) {
          ProStore.setUnlocked(appContext, false)
        }
      }
      done()
    }
  }

  private fun queryProduct(done: () -> Unit) {
    val params = QueryProductDetailsParams.newBuilder()
      .setProductList(
        listOf(
          QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT)
            .setProductType(BillingClient.ProductType.INAPP)
            .build(),
        ),
      )
      .build()
    client.queryProductDetailsAsync(params) { result, details ->
      if (result.responseCode == BillingClient.BillingResponseCode.OK) {
        product = details.productDetailsList.firstOrNull()
      }
      done()
    }
  }

  private fun connect(done: (Boolean) -> Unit) {
    if (client.isReady) {
      done(true)
      return
    }
    try {
      client.startConnection(object : BillingClientStateListener {
        override fun onBillingSetupFinished(result: BillingResult) {
          available = result.responseCode == BillingClient.BillingResponseCode.OK
          done(available)
        }

        override fun onBillingServiceDisconnected() {
          available = false
        }
      })
    } catch (error: Exception) {
      // No Play Store at all, e.g. a sideloaded build on a phone without Google.
      Log.i(TAG, "Play Billing is unavailable.", error)
      available = false
      done(false)
    }
  }

  fun close() {
    runCatching { client.endConnection() }
  }

  private fun describe(result: BillingResult): String =
    result.debugMessage.ifBlank { "Google Play returned code ${result.responseCode}." }

  companion object {
    private const val TAG = "FocusGuard"
    private const val PRODUCT = ProStore.PRODUCT_ID
  }
}
