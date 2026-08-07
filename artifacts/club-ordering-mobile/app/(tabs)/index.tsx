import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ClubOrder,
  MenuCategory,
  MenuItem,
  OrderStatus,
  StaffMode,
  useClub,
} from '@/context/ClubContext';
import colors from '@/constants/colors';
import { clubSettings } from '@/config/clubSettings';
import StaffOperationsDashboard from '@/components/StaffOperationsDashboard';

type ViewName = 'home' | 'menu' | 'cart' | 'request' | 'bill' | 'staff';

const formatMoney = (amount: number) => {
  try {
    return new Intl.NumberFormat(clubSettings.currency.locale, {
      style: 'currency',
      currency: clubSettings.currency.code,
      maximumFractionDigits: clubSettings.currency.minorUnit,
    }).format(amount);
  } catch {
    return `${clubSettings.currency.code} ${amount.toLocaleString()}`;
  }
};

const roleLabel: Record<StaffMode, string> = {
  guest: 'Guest view',
  waiter: 'Waiter',
  bartender: 'Bar',
  dj: 'DJ',
  admin: 'Admin',
};

function Icon({
  name,
  size = 20,
  color = colors.light.foreground,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

function Pill({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'gold' | 'green' | 'red';
}) {
  const toneStyle = {
    muted: styles.pillMuted,
    gold: styles.pillGold,
    green: styles.pillGreen,
    red: styles.pillRed,
  }[tone];
  return <View style={[styles.pill, toneStyle]}>{children}</View>;
}

function TopBar({
  title = 'LOUNGEOS',
  subtitle,
  onBack,
  onStaff,
  tableNumber,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onStaff?: () => void;
  tableNumber?: number;
}) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.iconButton} testID="back-button">
          <Icon name="arrow-back" size={21} />
        </Pressable>
      ) : (
        <View style={styles.logoMark}>
          <Icon name="moon" size={16} color={colors.light.primary} />
        </View>
      )}
      <View style={styles.topTitleWrap}>
        <Text style={styles.eyebrow}>{title}</Text>
        {subtitle ? <Text style={styles.topSubtitle}>{subtitle}</Text> : null}
      </View>
      {onStaff ? (
        <Pressable onPress={onStaff} style={styles.staffButton} testID="staff-mode-button">
          <Icon name="grid-outline" size={15} color={colors.light.primary} />
          <Text style={styles.staffButtonText}>Staff</Text>
        </Pressable>
      ) : tableNumber !== undefined ? (
        <View style={styles.tablePill}>
          <View style={styles.liveDot} />
          <Text style={styles.tableText}>TABLE {tableNumber}</Text>
        </View>
      ) : <View style={styles.topBarSpacer} />}
    </View>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, accent && styles.actionTileAccent, pressed && styles.pressed]}
      testID={`action-${label.toLowerCase().replace(' ', '-')}`}
    >
      <View style={[styles.actionIcon, accent && styles.actionIconAccent]}>
        <Icon name={icon} size={21} color={accent ? colors.light.primaryForeground : colors.light.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function MenuCard({
  item,
  onAdd,
  compact = false,
}: {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.menuCard, compact && styles.menuCardCompact]}>
      <View style={[styles.menuImageWrap, compact && styles.menuImageWrapCompact]}>
        <Image source={item.image as ImageSourcePropType} style={styles.menuImage} />
        <View style={[styles.imageTint, { backgroundColor: `${item.accent}55` }]} />
        {item.popular ? (
          <View style={styles.popularBadge}>
            <Icon name="flame" size={12} color={colors.light.primaryForeground} />
            <Text style={styles.popularText}>Popular</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.menuCardBody}>
        <View style={styles.menuTextWrap}>
          <Text style={styles.menuName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.menuDescription} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.menuPrice}>{formatMoney(item.price)}</Text>
        </View>
        <Pressable
          onPress={() => onAdd(item)}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          testID={`add-${item.id}`}
        >
          <Icon name="add" size={22} color={colors.light.primaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

function OrderStatusPill({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { label: string; tone: 'gold' | 'green' | 'muted' }> = {
    draft: { label: 'Draft', tone: 'muted' },
    submitted: { label: 'Submitted', tone: 'gold' },
    accepted: { label: 'Accepted', tone: 'gold' },
    preparing: { label: 'Preparing', tone: 'gold' },
    ready: { label: 'Ready', tone: 'green' },
    delivered: { label: 'Delivered', tone: 'muted' },
    cancelled: { label: 'Cancelled', tone: 'muted' },
  };
  const item = config[status];
  return <Pill tone={item.tone}><Text style={styles.pillText}>{item.label}</Text></Pill>;
}

function OrderRow({
  order,
  showControls = false,
  onStatus,
  onPaid,
  onCancel,
}: {
  order: ClubOrder;
  showControls?: boolean;
  onStatus?: (status: OrderStatus) => void;
  onPaid?: () => void;
  onCancel?: () => void;
}) {
  return (
    <View style={styles.orderRow}>
      <View style={styles.orderTop}>
        <View>
          <Text style={styles.orderRound}>ROUND {order.round}</Text>
          <Text style={styles.orderTime}>{order.createdAt} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} items</Text>
        </View>
        <View style={styles.orderRight}>
          <Text style={styles.orderTotal}>{formatMoney(order.total)}</Text>
          <OrderStatusPill status={order.status} />
        </View>
      </View>
      <Text style={styles.orderItems} numberOfLines={2}>
        {order.items.map((item) => `${item.quantity}× ${item.name}`).join('  ·  ')}
      </Text>
      {showControls ? (
        <View style={styles.orderControls}>
          {order.status !== 'delivered' && order.status !== 'cancelled' ? (
            <Pressable
              onPress={() => onStatus?.(
                order.status === 'submitted' || order.status === 'accepted'
                  ? 'preparing'
                  : order.status === 'preparing'
                    ? 'ready'
                    : 'delivered',
              )}
              style={styles.outlineAction}
            >
              <Icon name={order.status === 'ready' ? 'checkmark-circle-outline' : 'restaurant-outline'} size={16} color={colors.light.primary} />
              <Text style={styles.outlineActionText}>{order.status === 'ready' ? 'Mark delivered' : 'Advance order'}</Text>
            </Pressable>
          ) : null}
          {!order.paid ? (
            <Pressable onPress={onPaid} style={styles.cashAction}>
              <Text style={styles.cashActionText}>Close cash</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {!showControls && onCancel && (order.status === 'submitted' || order.status === 'accepted') ? (
        <Pressable onPress={onCancel} style={styles.cancelAction}>
          <Icon name="close-circle-outline" size={15} color={colors.light.destructive} />
          <Text style={styles.cancelActionText}>Cancel order</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const [view, setView] = useState<ViewName>('home');
  const [category, setCategory] = useState<MenuCategory | 'All'>('All');
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [feedback, setFeedback] = useState('');
  const [staffMode, setStaffMode] = useState<StaffMode>('waiter');
  const {
    clubSettings,
    menu,
    menuCategories,
    tableNumber,
    cart,
    orders,
    songRequests,
    waiterCalls,
    billTotal,
    cartCount,
    addToCart,
    changeQuantity,
    removeFromCart,
    submitOrder,
    requestSong,
    callWaiter,
    payBill,
    requestClose,
    cancelClose,
    tableSessionStatus,
    customerAccessLevel,
    customerApprovalStatus,
    markOrderStatus,
    markOrderPaid,
    cancelOrder,
    updateSongStatus,
    removeSongRequest,
    setSelectedMode,
    sessionActive,
    isLoading,
    isSubmitting,
    errorMessage,
    pendingOrderCount,
    clearError,
  } = useClub();
  const money = formatMoney;
  const clubShortName = clubSettings.branding.shortName;
  const canMutateTable =
    customerAccessLevel !== 'temporary' && customerApprovalStatus === 'approved';
  const isPendingApproval = customerApprovalStatus === 'pending-approval';

  const show = (next: ViewName) => {
    setFeedback('');
    setView(next);
  };
  const buzz = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
  };
  const addItem = (item: MenuItem) => {
    buzz();
    addToCart(item);
    setFeedback(`${item.name} added to your round`);
  };
  const filteredMenu = useMemo(
    () => (category === 'All' ? menu : menu.filter((item) => item.category === category)),
    [category, menu],
  );
  const activeOrders = orders.filter((order) => order.status !== 'delivered' && order.status !== 'cancelled');
  const queuedCalls = waiterCalls.filter((call) => !call.resolved);
  const drinkCategory = menuCategories.find((item) => item.toLowerCase().includes('drink'));
  const foodCategory = menuCategories.find((item) => item.toLowerCase().includes('food'));
  const liveSales = orders.reduce((sum, order) => sum + order.total, 0);

  const renderHome = () => (
    <>
      <TopBar tableNumber={tableNumber} onStaff={() => show('staff')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 8, paddingBottom: bottomInset + 30 }]}
      >
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.welcomeKicker}>GOOD EVENING</Text>
            <Text style={styles.welcomeTitle}>Your night,<Text style={styles.goldText}> your way.</Text></Text>
          </View>
          <View style={styles.tableCircle}>
            <Text style={styles.tableCircleNumber}>{tableNumber ?? '—'}</Text>
            <Text style={styles.tableCircleLabel}>TABLE</Text>
          </View>
        </View>

         {!canMutateTable ? (
           <View style={styles.accessBanner}>
             <Icon name={isPendingApproval ? 'time-outline' : 'eye-outline'} size={18} color={colors.light.primary} />
             <View style={styles.accessBannerCopy}>
               <Text style={styles.accessBannerTitle}>
                 {isPendingApproval ? 'Waiting for waiter approval' : 'View-only table access'}
               </Text>
               <Text style={styles.accessBannerText}>
                 {isPendingApproval
                   ? 'You can stay on this screen while your waiter approves your join request.'
                   : 'You can view the shared running bill, but only the waiter can add orders or settle it.'}
               </Text>
             </View>
           </View>
         ) : null}
         <View style={styles.billHero}>
          <View style={styles.billHeroGlow} />
          <View style={styles.billHeroHeader}>
            <View>
              <Text style={styles.heroLabel}>YOUR RUNNING TAB</Text>
              <Text style={styles.heroAmount}>{money(billTotal)}</Text>
            </View>
            <View style={styles.openBadge}><View style={styles.liveDot} /><Text style={styles.openText}>OPEN</Text></View>
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.heroMeta}>{activeOrders.length} active rounds{pendingOrderCount ? ` · ${pendingOrderCount} waiting to sync` : ''}</Text>
            <Pressable onPress={() => show('bill')} style={styles.heroLink}>
              <Text style={styles.heroLinkText}>View bill</Text>
              <Icon name="arrow-forward" size={15} color={colors.light.primary} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What are you in the mood for?</Text>
         {canMutateTable ? (
           <View style={styles.actionsGrid}>
             <ActionTile icon="wine-outline" label="Drinks" onPress={() => { setCategory(drinkCategory ?? 'All'); show('menu'); }} accent />
             <ActionTile icon="restaurant-outline" label="Food" onPress={() => { setCategory(foodCategory ?? 'All'); show('menu'); }} />
           </View>
         ) : null}
         <View style={styles.actionsGrid}>
          <ActionTile icon="musical-notes-outline" label="Request song" onPress={() => show('request')} />
          <ActionTile icon="hand-left-outline" label="Call waiter" onPress={() => { buzz(); callWaiter(); setFeedback('Your waiter is on the way'); }} />
        </View>

        {feedback ? (
          <View style={styles.feedbackBar}>
            <Icon name="checkmark-circle" size={17} color={colors.light.primary} />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}
        {!sessionActive ? (
          <View style={styles.feedbackBar}>
            <Icon name="qr-code-outline" size={17} color={colors.light.primary} />
            <Text style={styles.feedbackText}>Scan your table QR code to start ordering.</Text>
          </View>
        ) : null}
        {isLoading && !menu.length ? (
          <View style={styles.feedbackBar}>
            <Icon name="sync-outline" size={17} color={colors.light.primary} />
            <Text style={styles.feedbackText}>Loading the live menu…</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular tonight</Text>
          <Pressable onPress={() => { setCategory('All'); show('menu'); }}><Text style={styles.seeAll}>See menu</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalMenu}>
          {menu.filter((item) => item.popular).map((item) => (
            <MenuCard key={item.id} item={item} onAdd={addItem} compact />
          ))}
        </ScrollView>

        <View style={styles.liveCard}>
          <View style={styles.liveCardIcon}><Icon name="sparkles-outline" size={19} color={colors.light.primary} /></View>
          <View style={styles.liveCardCopy}>
            <Text style={styles.liveCardTitle}>Live at {clubShortName}</Text>
            <Text style={styles.liveCardText}>Live service updates will appear here when connected.</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.light.mutedForeground} />
        </View>
      </ScrollView>
    </>
  );

  const renderMenu = () => (
    <>
      <TopBar title="MENU" subtitle={`${menu.length} picks for tonight`} onBack={() => show('home')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 8, paddingBottom: bottomInset + 112 }]}>
        <View style={styles.menuIntro}>
          <Text style={styles.pageTitle}>Set the pace.</Text>
         <Text style={styles.pageDescription}>Everything arrives at table {tableNumber}.</Text>
        </View>
        <View style={styles.categoryRow}>
          {(['All', ...menuCategories] as const).map((item) => (
            <Pressable key={item} onPress={() => setCategory(item)} style={[styles.categoryChip, category === item && styles.categoryChipActive]}>
              <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        {filteredMenu.map((item) => <MenuCard key={item.id} item={item} onAdd={addItem} />)}
      </ScrollView>
       {canMutateTable && cartCount ? (
        <Pressable onPress={() => show('cart')} style={[styles.floatingCart, { bottom: bottomInset + 18 }]} testID="view-cart">
          <View style={styles.cartCount}><Text style={styles.cartCountText}>{cartCount}</Text></View>
          <Text style={styles.floatingCartText}>View your round</Text>
          <Text style={styles.floatingCartTotal}>{money(cart.reduce((sum, item) => sum + item.price * item.quantity, 0))}</Text>
          <Icon name="arrow-forward" size={18} color={colors.light.primaryForeground} />
        </Pressable>
      ) : null}
    </>
  );

  const renderCart = () => (
    <>
      <TopBar title="YOUR ROUND" subtitle={`${cartCount} items`} onBack={() => show('menu')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 8, paddingBottom: bottomInset + 140 }]}>
        <Text style={styles.pageTitle}>Ready when you are.</Text>
        <Text style={styles.pageDescription}>Your order will be sent straight to the team.</Text>
        <View style={styles.cartList}>
          {cart.map((item) => (
            <View key={item.id} style={styles.cartRow}>
              <Image source={item.image as ImageSourcePropType} style={styles.cartImage} />
              <View style={styles.cartInfo}>
                <Text style={styles.cartName}>{item.name}</Text>
                <Text style={styles.cartPrice}>{money(item.price)} each</Text>
                <View style={styles.quantityRow}>
                  <Pressable onPress={() => changeQuantity(item.id, -1)} style={styles.quantityButton}><Icon name="remove" size={16} color={colors.light.foreground} /></Pressable>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <Pressable onPress={() => changeQuantity(item.id, 1)} style={styles.quantityButton}><Icon name="add" size={16} color={colors.light.foreground} /></Pressable>
                </View>
              </View>
              <View style={styles.cartRight}>
                <Text style={styles.cartLineTotal}>{money(item.price * item.quantity)}</Text>
                <Pressable onPress={() => removeFromCart(item.id)}><Icon name="trash-outline" size={17} color={colors.light.mutedForeground} /></Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.bottomCheckout, { paddingBottom: bottomInset + 14 }]}>
        <View style={styles.checkoutTotal}><Text style={styles.checkoutLabel}>ROUND TOTAL</Text><Text style={styles.checkoutAmount}>{money(cart.reduce((sum, item) => sum + item.price * item.quantity, 0))}</Text></View>
        <Pressable
          onPress={async () => {
            buzz();
            const sent = await submitOrder();
            if (sent) {
              setFeedback('Order sent to the team');
              show('bill');
            }
          }}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          testID="submit-order"
        >
          <Text style={styles.primaryButtonText}>{isSubmitting ? 'Sending…' : 'Send order'}</Text>
          <Icon name="arrow-forward" size={18} color={colors.light.primaryForeground} />
        </Pressable>
      </View>
    </>
  );

  const renderRequest = () => (
    <>
      <TopBar title="REQUEST A SONG" subtitle="Make it yours" onBack={() => show('home')} />
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 8, paddingBottom: bottomInset + 36 }]}>
          <View style={styles.requestHero}>
            <View style={styles.vinyl}><Icon name="musical-notes" size={31} color={colors.light.primary} /></View>
            <Text style={styles.pageTitle}>Your soundtrack.</Text>
            <Text style={styles.pageDescription}>Send a request to the DJ. We’ll let you know when it hits the floor.</Text>
          </View>
          <Text style={styles.inputLabel}>SONG TITLE</Text>
          <TextInput value={song} onChangeText={setSong} placeholder="e.g. One Dance" placeholderTextColor={colors.light.mutedForeground} style={styles.input} returnKeyType="next" />
          <Text style={styles.inputLabel}>ARTIST</Text>
          <TextInput value={artist} onChangeText={setArtist} placeholder="e.g. Drake" placeholderTextColor={colors.light.mutedForeground} style={styles.input} onSubmitEditing={Keyboard.dismiss} />
          <Pressable
            onPress={() => {
              if (!song.trim() || !artist.trim()) { setFeedback('Add a song title and artist first'); return; }
              buzz(); requestSong(song, artist); setSong(''); setArtist(''); setFeedback('Request sent to the DJ'); 
            }}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            testID="submit-song-request"
          >
            <Text style={styles.primaryButtonText}>Send request</Text>
            <Icon name="paper-plane-outline" size={18} color={colors.light.primaryForeground} />
          </Pressable>
          {feedback ? <View style={styles.feedbackBar}><Icon name="checkmark-circle" size={17} color={colors.light.primary} /><Text style={styles.feedbackText}>{feedback}</Text></View> : null}
          <View style={styles.queueHeader}><Text style={styles.sectionTitle}>Your queue</Text><Pill tone="muted"><Text style={styles.pillText}>{songRequests.filter((item) => item.status === 'queued').length} waiting</Text></Pill></View>
          {songRequests.map((item) => (
            <View key={item.id} style={styles.songRow}>
              <View style={styles.songDisc}><Icon name={item.status === 'playing' ? 'volume-high' : 'musical-note'} size={17} color={colors.light.primary} /></View>
              <View style={styles.songCopy}><Text style={styles.songName}>{item.song}</Text><Text style={styles.songArtist}>{item.artist}</Text></View>
              <Text style={[styles.songStatus, item.status === 'playing' && styles.songStatusPlaying]}>{item.status === 'playing' ? 'NOW PLAYING' : item.status.toUpperCase()}</Text>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );

  const renderBill = () => (
    <>
       <TopBar title="RUNNING BILL" subtitle={`Table ${tableNumber} · ${orders.length} rounds`} onBack={() => show('home')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 8, paddingBottom: bottomInset + 130 }]}>
        <View style={styles.billSummary}>
          <Text style={styles.heroLabel}>CURRENT TOTAL</Text>
          <Text style={styles.billSummaryAmount}>{money(billTotal)}</Text>
          <Text style={styles.billSummaryNote}>Service is included · no surprises</Text>
        </View>
        <Text style={styles.sectionTitle}>Tonight at table {tableNumber}</Text>
           {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
               onCancel={canMutateTable ? () => {
                void cancelOrder(order.id).then((cancelled) => {
                  if (cancelled) setFeedback('Order cancelled');
                });
               } : undefined}
            />
          ))}
         {canMutateTable ? <View style={styles.paymentCard}>
          <View style={styles.paymentHeader}><View><Text style={styles.paymentTitle}>Ready to settle?</Text><Text style={styles.paymentSubtitle}>Choose how you’d like to pay.</Text></View><Icon name="lock-closed-outline" size={19} color={colors.light.mutedForeground} /></View>
          <Pressable
            onPress={() => {
              buzz();
              void payBill('mpesa').then((paid) => {
                if (paid) setFeedback('M-Pesa payment request submitted');
              });
            }}
            style={[styles.paymentOption, styles.disabledPaymentOption]}
          >
            <View style={[styles.paymentIcon, styles.mpesaIcon]}><Text style={styles.mpesaText}>M</Text></View>
            <View style={styles.paymentCopy}><Text style={styles.paymentName}>M-Pesa</Text><Text style={styles.paymentDescription}>Not connected yet</Text></View>
            <Icon name="chevron-forward" size={18} color={colors.light.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => {
              buzz();
              void payBill('cash').then((paid) => {
                if (paid) setFeedback('Cash payment submitted for waiter verification');
              });
            }}
            style={styles.paymentOption}
          >
            <View style={[styles.paymentIcon, styles.cashIcon]}><Icon name="cash-outline" size={18} color={colors.light.primaryForeground} /></View>
            <View style={styles.paymentCopy}><Text style={styles.paymentName}>Cash</Text><Text style={styles.paymentDescription}>Submit for waiter verification</Text></View>
            <Icon name="chevron-forward" size={18} color={colors.light.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => {
              buzz();
              void payBill('till').then((paid) => {
                if (paid) setFeedback('Till payment submitted for waiter verification');
              });
            }}
            style={styles.paymentOption}
          >
            <View style={[styles.paymentIcon, styles.tillIcon]}><Text style={styles.tillText}>T</Text></View>
            <View style={styles.paymentCopy}><Text style={styles.paymentName}>Till</Text><Text style={styles.paymentDescription}>Submit after paying at the till</Text></View>
            <Icon name="chevron-forward" size={18} color={colors.light.mutedForeground} />
          </Pressable>
          {tableSessionStatus === 'active' ? (
            <Pressable
              onPress={() => {
                buzz();
                void requestClose().then((closed) => {
                  if (closed) setFeedback('Close request sent to your waiter');
                });
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Close My Tab</Text>
              <Icon name="arrow-forward" size={17} color={colors.light.background} />
            </Pressable>
          ) : tableSessionStatus === 'awaiting-payment' || tableSessionStatus === 'splitting-bill' ? (
             <View style={styles.finishingCard}>
               <View style={styles.finishingHeader}>
                 <Icon name="time-outline" size={18} color={colors.light.primary} />
                 <Text style={styles.finishingTitle}>Finishing up</Text>
               </View>
               <Text style={styles.finishingCopy}>Ordering is paused while your waiter confirms payment.</Text>
               <Pressable
                 onPress={() => {
                   buzz();
                   void cancelClose().then((cancelled) => {
                     if (cancelled) setFeedback('Close request cancelled');
                   });
                 }}
                 style={styles.outlineButton}
               >
                 <Text style={styles.outlineActionText}>Cancel Close</Text>
               </Pressable>
             </View>
           ) : null}
         </View> : (
           <View style={styles.accessBanner}>
             <Icon name="lock-closed-outline" size={18} color={colors.light.primary} />
             <View style={styles.accessBannerCopy}>
               <Text style={styles.accessBannerTitle}>Settlement is waiter-controlled</Text>
               <Text style={styles.accessBannerText}>Ask your waiter to take payment or close the table.</Text>
             </View>
           </View>
         )}
        {feedback ? <View style={styles.feedbackBar}><Icon name="checkmark-circle" size={17} color={colors.light.primary} /><Text style={styles.feedbackText}>{feedback}</Text></View> : null}
      </ScrollView>
    </>
  );

  const renderStaff = () => {
    return (
      <>
        <TopBar title={`${clubShortName} OPS`} subtitle={roleLabel[staffMode]} onBack={() => show('home')} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 8, paddingBottom: bottomInset + 30 }]}>
          <StaffOperationsDashboard />
        </ScrollView>
      </>
    );
  };

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0} style={styles.flex}>
      <View style={styles.app}>
        {errorMessage ? (
          <Pressable onPress={clearError} style={styles.errorBanner}>
            <Icon name="alert-circle-outline" size={17} color={colors.light.destructive} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </Pressable>
        ) : null}
        {view === 'home' ? renderHome() : view === 'menu' ? renderMenu() : view === 'cart' ? renderCart() : view === 'request' ? renderRequest() : view === 'bill' ? renderBill() : renderStaff()}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  app: { flex: 1, backgroundColor: colors.light.background },
  scrollContent: { paddingHorizontal: 20, gap: 18 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4, minHeight: 62, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: `${colors.light.background}F2` },
  logoMark: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.accent, borderWidth: 1, borderColor: colors.light.border },
  topTitleWrap: { flex: 1, marginLeft: 10 },
  topBarSpacer: { width: 36 },
  eyebrow: { color: colors.light.foreground, fontSize: 14, fontWeight: '700', letterSpacing: 2.1 },
  topSubtitle: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 3, letterSpacing: 0.2 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  staffButton: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.light.accent, borderWidth: 1, borderColor: colors.light.border },
  staffButtonText: { color: colors.light.primary, fontSize: 12, fontWeight: '700' },
  tablePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  tableText: { color: colors.light.mutedForeground, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#75c88d' },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomeKicker: { color: colors.light.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 6 },
  welcomeTitle: { color: colors.light.foreground, fontSize: 29, lineHeight: 35, fontWeight: '700', letterSpacing: -0.8 },
  goldText: { color: colors.light.primary },
  tableCircle: { width: 66, height: 66, borderRadius: 33, borderWidth: 1, borderColor: colors.light.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.accent, transform: [{ rotate: '8deg' }] },
  tableCircleNumber: { color: colors.light.primary, fontSize: 23, fontWeight: '700', lineHeight: 24 },
  tableCircleLabel: { color: colors.light.mutedForeground, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  billHero: { overflow: 'hidden', borderRadius: 24, padding: 20, backgroundColor: '#241819', borderWidth: 1, borderColor: '#54302a' },
  billHeroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -45, top: -90, backgroundColor: '#9b503033' },
  billHeroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: '#b9a59b', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  heroAmount: { color: '#f8d17b', fontSize: 32, fontWeight: '700', marginTop: 8, letterSpacing: -1 },
  openBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#183321', borderRadius: 10 },
  openText: { color: '#8bd6a1', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  heroFooter: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroMeta: { color: '#b9a59b', fontSize: 12 },
  heroLink: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  heroLinkText: { color: colors.light.primary, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: colors.light.foreground, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionTile: { width: '48.2%', minHeight: 92, borderRadius: 18, padding: 14, justifyContent: 'space-between', backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  actionTileAccent: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  actionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.accent },
  actionIconAccent: { backgroundColor: '#efd08a' },
  actionLabel: { color: colors.light.foreground, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  feedbackBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 13, backgroundColor: '#1b3225', borderWidth: 1, borderColor: '#31563e' },
  feedbackText: { color: '#9fe0b0', fontSize: 12, fontWeight: '600', flex: 1 },
  accessBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 15, backgroundColor: colors.light.secondary, borderWidth: 1, borderColor: colors.light.border, marginBottom: 16 },
  accessBannerCopy: { flex: 1, gap: 3 },
  accessBannerTitle: { color: colors.light.foreground, fontSize: 12, fontWeight: '700' },
  accessBannerText: { color: colors.light.mutedForeground, fontSize: 11, lineHeight: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { color: colors.light.primary, fontSize: 12, fontWeight: '700' },
  horizontalMenu: { gap: 12, paddingRight: 10 },
  menuCard: { backgroundColor: colors.light.card, borderRadius: 20, borderWidth: 1, borderColor: colors.light.border, overflow: 'hidden' },
  menuCardCompact: { width: 238 },
  menuImageWrap: { height: 145, position: 'relative', overflow: 'hidden', backgroundColor: colors.light.accent },
  menuImageWrapCompact: { height: 128 },
  menuImage: { width: '100%', height: '100%', opacity: 0.78 },
  imageTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  popularBadge: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#1b1210dd' },
  popularText: { color: '#f9d484', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  menuCardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 13 },
  menuTextWrap: { flex: 1, minWidth: 0, paddingRight: 8 },
  menuName: { color: colors.light.foreground, fontSize: 14, fontWeight: '700' },
  menuDescription: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 4 },
  menuPrice: { color: colors.light.primary, fontSize: 12, fontWeight: '700', marginTop: 8 },
  addButton: { width: 35, height: 35, borderRadius: 13, backgroundColor: colors.light.primary, alignItems: 'center', justifyContent: 'center' },
  liveCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#151d1b', borderWidth: 1, borderColor: '#263e36' },
  liveCardIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1c3028' },
  liveCardCopy: { flex: 1 },
  liveCardTitle: { color: colors.light.foreground, fontSize: 13, fontWeight: '700' },
  liveCardText: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 3 },
  menuIntro: { marginTop: 8 },
  pageTitle: { color: colors.light.foreground, fontSize: 28, fontWeight: '700', letterSpacing: -0.7 },
  pageDescription: { color: colors.light.mutedForeground, fontSize: 13, lineHeight: 19, marginTop: 5 },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 13, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  categoryChipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  categoryText: { color: colors.light.mutedForeground, fontSize: 12, fontWeight: '700' },
  categoryTextActive: { color: colors.light.primaryForeground },
  floatingCart: { position: 'absolute', left: 20, right: 20, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.light.primary, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  cartCount: { width: 27, height: 27, borderRadius: 10, backgroundColor: '#efd08a', alignItems: 'center', justifyContent: 'center' },
  cartCountText: { color: colors.light.primaryForeground, fontSize: 12, fontWeight: '800' },
  floatingCartText: { color: colors.light.primaryForeground, fontSize: 13, fontWeight: '700', flex: 1 },
  floatingCartTotal: { color: colors.light.primaryForeground, fontSize: 12, fontWeight: '700' },
  cartList: { gap: 10 },
  cartRow: { flexDirection: 'row', padding: 12, borderRadius: 18, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  cartImage: { width: 74, height: 74, borderRadius: 14 },
  cartInfo: { flex: 1, paddingLeft: 12 },
  cartName: { color: colors.light.foreground, fontSize: 14, fontWeight: '700' },
  cartPrice: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 4 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  quantityButton: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.secondary },
  quantityText: { color: colors.light.foreground, fontSize: 13, fontWeight: '700' },
  cartRight: { alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 2 },
  cartLineTotal: { color: colors.light.primary, fontSize: 12, fontWeight: '700' },
  bottomCheckout: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 13, backgroundColor: `${colors.light.background}F7`, borderTopWidth: 1, borderTopColor: colors.light.border },
  checkoutTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  checkoutLabel: { color: colors.light.mutedForeground, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  checkoutAmount: { color: colors.light.foreground, fontSize: 16, fontWeight: '700' },
  primaryButton: { minHeight: 52, borderRadius: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.light.primary },
  primaryButtonText: { color: colors.light.primaryForeground, fontSize: 14, fontWeight: '800' },
  finishingCard: { marginTop: 14, borderRadius: 16, padding: 15, gap: 10, backgroundColor: colors.light.secondary, borderWidth: 1, borderColor: colors.light.border },
  finishingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  finishingTitle: { color: colors.light.foreground, fontSize: 14, fontWeight: '800' },
  finishingCopy: { color: colors.light.mutedForeground, fontSize: 13, lineHeight: 19 },
  outlineButton: { minHeight: 44, borderRadius: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.background },
  requestHero: { padding: 20, borderRadius: 22, backgroundColor: '#241819', borderWidth: 1, borderColor: '#54302a', alignItems: 'flex-start' },
  vinyl: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3e2522', borderWidth: 1, borderColor: '#765044', marginBottom: 18 },
  inputLabel: { color: colors.light.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: -10 },
  input: { height: 53, paddingHorizontal: 16, borderRadius: 15, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border, color: colors.light.foreground, fontSize: 14 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  pillMuted: { backgroundColor: colors.light.secondary },
  pillGold: { backgroundColor: '#48361b' },
  pillGreen: { backgroundColor: '#1b3827' },
  pillRed: { backgroundColor: '#422320' },
  pillText: { color: colors.light.mutedForeground, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  songDisc: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.accent },
  songCopy: { flex: 1 },
  songName: { color: colors.light.foreground, fontSize: 13, fontWeight: '700' },
  songArtist: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 3 },
  songStatus: { color: colors.light.mutedForeground, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  songStatusPlaying: { color: colors.light.primary },
  billSummary: { padding: 21, borderRadius: 22, backgroundColor: '#241819', borderWidth: 1, borderColor: '#54302a' },
  billSummaryAmount: { color: '#f8d17b', fontSize: 36, fontWeight: '700', marginTop: 7 },
  billSummaryNote: { color: '#b9a59b', fontSize: 11, marginTop: 5 },
  orderRow: { padding: 15, borderRadius: 18, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderRound: { color: colors.light.foreground, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  orderTime: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 5 },
  orderRight: { alignItems: 'flex-end', gap: 7 },
  orderTotal: { color: colors.light.primary, fontSize: 13, fontWeight: '700' },
  orderItems: { color: colors.light.mutedForeground, fontSize: 12, lineHeight: 18, marginTop: 13 },
  paymentCard: { padding: 16, borderRadius: 19, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border, gap: 13 },
  paymentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paymentTitle: { color: colors.light.foreground, fontSize: 15, fontWeight: '700' },
  paymentSubtitle: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 3 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 14, backgroundColor: colors.light.secondary },
  disabledPaymentOption: { opacity: 0.62 },
  paymentIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  mpesaIcon: { backgroundColor: '#76bc45' },
  mpesaText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cashIcon: { backgroundColor: colors.light.primary },
  tillIcon: { backgroundColor: colors.light.foreground },
  tillText: { color: colors.light.background, fontSize: 16, fontWeight: '800' },
  paymentCopy: { flex: 1 },
  paymentName: { color: colors.light.foreground, fontSize: 13, fontWeight: '700' },
  paymentDescription: { color: colors.light.mutedForeground, fontSize: 10, marginTop: 2 },
  cashNote: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 3 },
  cashNoteText: { color: colors.light.mutedForeground, fontSize: 11, flex: 1 },
  staffWelcome: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 },
  staffOnline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: '#183321' },
  staffOnlineText: { color: '#8bd6a1', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  roleRow: { gap: 8, paddingRight: 10 },
  roleChip: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  roleChipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  roleChipText: { color: colors.light.mutedForeground, fontSize: 11, fontWeight: '700' },
  roleChipTextActive: { color: colors.light.primaryForeground },
  staffStat: { padding: 18, borderRadius: 19, backgroundColor: '#171b18', borderWidth: 1, borderColor: '#2d4135' },
  staffStatValue: { color: colors.light.foreground, fontSize: 28, fontWeight: '700', marginTop: 7 },
  staffStatUnit: { color: colors.light.mutedForeground, fontSize: 12, fontWeight: '500' },
  callAlert: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 15, backgroundColor: '#3d2d19', borderWidth: 1, borderColor: '#6c5024' },
  callAlertText: { flex: 1, color: '#f6d688', fontSize: 12, fontWeight: '700' },
  orderControls: { flexDirection: 'row', gap: 8, marginTop: 13 },
  outlineAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.light.border, flex: 1 },
  outlineActionText: { color: colors.light.primary, fontSize: 10, fontWeight: '700' },
  cashAction: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.light.secondary },
  cashActionText: { color: colors.light.mutedForeground, fontSize: 10, fontWeight: '700' },
  cancelAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  cancelActionText: { color: colors.light.destructive, fontSize: 10, fontWeight: '700' },
  djRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  djNumber: { width: 30, alignItems: 'center' },
  djNumberText: { color: colors.light.mutedForeground, fontSize: 10, fontWeight: '800' },
  djActions: { flexDirection: 'row', gap: 6 },
  smallIconButton: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.secondary },
  metricsGrid: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, padding: 15, borderRadius: 17, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  metricLabel: { color: colors.light.mutedForeground, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  metricValue: { color: colors.light.foreground, fontSize: 19, fontWeight: '700', marginTop: 9 },
  metricDelta: { color: '#8bd6a1', fontSize: 10, marginTop: 5 },
  adminList: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  adminListRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  adminListText: { color: colors.light.foreground, fontSize: 13, fontWeight: '600', flex: 1 },
  demoNote: { flexDirection: 'row', gap: 9, padding: 14, borderRadius: 15, backgroundColor: colors.light.secondary, marginTop: 4 },
  demoNoteText: { flex: 1, color: colors.light.mutedForeground, fontSize: 10, lineHeight: 15 },
  errorBanner: { position: 'absolute', zIndex: 10, top: 66, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: '#3f201e', borderWidth: 1, borderColor: '#75423b' },
  errorBannerText: { flex: 1, color: '#ffd1c9', fontSize: 11, lineHeight: 16, fontWeight: '600' },
});