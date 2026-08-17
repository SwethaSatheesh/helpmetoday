import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  DemoState,
  Job,
  JobStatus,
  Persona,
  Service,
  Session,
  WorkerProfile,
  demoMarketplaceBackend,
} from './src/backend/demoMarketplaceBackend';

const logo = require('./assets/logo.png');

const colors = {
  cream: '#f7f2ea',
  card: '#fffaf4',
  forest: '#173d30',
  moss: '#61705a',
  sage: '#dfe6d5',
  gold: '#b58a4a',
  text: '#16201b',
  muted: '#77736b',
  border: '#eadfce',
  danger: '#9b3d2f',
};

const workerTabs = ['Home', 'Jobs', 'Earnings', 'Notifications', 'Profile'] as const;
type WorkerTab = (typeof workerTabs)[number];
const customerTabs = ['Home', 'Jobs', 'Bookings', 'Profile'] as const;
type CustomerTab = (typeof customerTabs)[number];
const adminTabs = ['Home', 'Bookings', 'Revenue', 'Reports', 'Ops'] as const;
type AdminTab = (typeof adminTabs)[number];
type JobFilter = 'Requests' | 'Upcoming' | 'In Progress' | 'Completed' | 'Cancelled';

const jobFilters: JobFilter[] = ['Requests', 'Upcoming', 'In Progress', 'Completed', 'Cancelled'];

export default function App() {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DemoState | null>(null);
  const [workerTab, setWorkerTab] = useState<WorkerTab>('Home');
  const [customerTab, setCustomerTab] = useState<CustomerTab>('Home');
  const [adminTab, setAdminTab] = useState<AdminTab>('Home');
  const [jobFilter, setJobFilter] = useState<JobFilter>('Requests');
  const [message, setMessage] = useState('Demo backend ready');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const nextState = await demoMarketplaceBackend.getState();
    setData(nextState);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (nextPersona: Persona) => {
    setLoading(true);
    const method = nextPersona === 'admin' ? 'email' : 'demo';
    const nextSession = await demoMarketplaceBackend.login(nextPersona, method);
    setPersona(nextPersona);
    setSession(nextSession);
    setWorkerTab('Home');
    setCustomerTab('Home');
    setAdminTab('Home');
    setMessage(`${titleCase(nextPersona)} demo account loaded.`);
    await refresh();
  };

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      setMessage(label);
      await action();
      await refresh();
      setMessage(`${label} completed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed');
    }
  };

  if (!data) {
    return <LoadingScreen message="Loading seeded demo data..." />;
  }

  if (!persona || !session) {
    return <PersonaScreen onLogin={login} message={message} />;
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.screen}>
        <AppHeader
          persona={persona}
          session={session}
          message={loading ? 'Loading...' : message}
          onBack={() => {
            setPersona(null);
            setSession(null);
          }}
          onReset={() => runAction('Resetting demo data', demoMarketplaceBackend.resetDemo)}
        />

        {persona === 'worker' && (
          <WorkerApp
            data={data}
            activeTab={workerTab}
            jobFilter={jobFilter}
            onChangeFilter={setJobFilter}
            onSetAvailability={(available) =>
              runAction(available ? 'Turning availability on' : 'Turning availability off', () =>
                demoMarketplaceBackend.setWorkerAvailability(available),
              )
            }
            onAccept={(jobId) => runAction('Accepting request', () => demoMarketplaceBackend.acceptJob(jobId))}
            onReject={(jobId) => runAction('Rejecting request', () => demoMarketplaceBackend.rejectJob(jobId, 'Schedule conflict'))}
            onNavigate={(jobId) => runAction('Starting navigation', () => demoMarketplaceBackend.navigateToJob(jobId))}
            onArrived={(jobId) => runAction('Marking arrived', () => demoMarketplaceBackend.markArrived(jobId))}
            onStart={(jobId) => runAction('Verifying Start OTP 1234', () => demoMarketplaceBackend.verifyStartOtp(jobId, demoMarketplaceBackend.startOtp))}
            onComplete={(jobId) => runAction('Verifying End OTP 5678', () => demoMarketplaceBackend.verifyEndOtp(jobId, demoMarketplaceBackend.endOtp))}
            onWorkerReview={(jobId) => runAction('Submitting worker review', () => demoMarketplaceBackend.submitWorkerReview(jobId))}
            onIssue={(jobId) => runAction('Reporting issue', () => demoMarketplaceBackend.reportIssue(jobId, 'OTP unavailable'))}
            onEditProfile={() => runAction('Saving profile and availability edits', demoMarketplaceBackend.updateWorkerProfile)}
          />
        )}

        {persona === 'customer' && (
          <CustomerDemo
            data={data}
            activeTab={customerTab}
            onRequest={() => runAction('Sending booking request to Alex', demoMarketplaceBackend.requestCleaningBooking)}
            onAddToCart={(workerId, serviceId) => runAction('Adding worker to cart', () => demoMarketplaceBackend.addBookingToCart(workerId, serviceId))}
            onRemoveCartItem={(cartItemId) => runAction('Removing cart item', () => demoMarketplaceBackend.removeCartItem(cartItemId))}
            onCheckout={() => runAction('Checking out cart and creating master booking', demoMarketplaceBackend.checkoutCart)}
            onAcceptTerms={() => runAction('Accepting customer terms', () => demoMarketplaceBackend.acceptTerms('customer'))}
            onCustomerReview={(jobId) => runAction('Submitting customer review', () => demoMarketplaceBackend.submitCustomerReview(jobId))}
          />
        )}

        {persona === 'admin' && (
          <AdminDemo
            data={data}
            activeTab={adminTab}
            onPay={(jobId) => runAction('Marking payout paid', () => demoMarketplaceBackend.markPayoutPaid(jobId))}
          />
        )}
      </ScrollView>

      {persona === 'worker' && (
        <BottomNav tabs={workerTabs} active={workerTab} onSelect={setWorkerTab} />
      )}
      {persona === 'customer' && (
        <BottomNav tabs={customerTabs} active={customerTab} onSelect={setCustomerTab} />
      )}
      {persona === 'admin' && (
        <BottomNav tabs={adminTabs} active={adminTab} onSelect={setAdminTab} />
      )}
    </SafeAreaView>
  );
}

function PersonaScreen({ onLogin, message }: { onLogin: (persona: Persona) => void; message: string }) {
  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.hero}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.kicker}>Find work. Help customers. Get paid.</Text>
          <Text style={styles.heroTitle}>Help Me Today demo</Text>
          <Text style={styles.heroCopy}>
            Select a persona. The Worker flow is primary, with enough Customer and Admin functionality to show the complete job lifecycle.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Choose persona</Text>
          <PersonaOption
            title="Worker"
            description="Signup/login, services, availability, job requests, OTP lifecycle, earnings, notifications, profile."
            cta="Open Worker"
            onPress={() => onLogin('worker')}
          />
          <PersonaOption
            title="Customer"
            description="Search for Cleaning, view workers, request Alex Morgan, see OTPs, submit review."
            cta="Open Customer"
            onPress={() => onLogin('customer')}
          />
          <PersonaOption
            title="Admin"
            description="See gross amount, 7% commission, worker payable, issues, reviews, payout status."
            cta="Open Admin"
            onPress={() => onLogin('admin')}
          />
        </View>

        <BackendStatus message={message} />
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkerApp({
  data,
  activeTab,
  jobFilter,
  onChangeFilter,
  onSetAvailability,
  onAccept,
  onReject,
  onNavigate,
  onArrived,
  onStart,
  onComplete,
  onWorkerReview,
  onIssue,
  onEditProfile,
}: {
  data: DemoState;
  activeTab: WorkerTab;
  jobFilter: JobFilter;
  onChangeFilter: (filter: JobFilter) => void;
  onSetAvailability: (available: boolean) => void;
  onAccept: (jobId: string) => void;
  onReject: (jobId: string) => void;
  onNavigate: (jobId: string) => void;
  onArrived: (jobId: string) => void;
  onStart: (jobId: string) => void;
  onComplete: (jobId: string) => void;
  onWorkerReview: (jobId: string) => void;
  onIssue: (jobId: string) => void;
  onEditProfile: () => void;
}) {
  const worker = demoWorker(data);
  const workerJobs = data.jobs.filter((job) => job.workerId === worker.id);
  const nextJob = workerJobs.find((job) => job.status === 'SCHEDULED');
  const requestJobs = workerJobs.filter((job) => job.status === 'REQUESTED');
  const completedJobs = workerJobs.filter((job) => job.status === 'PAID' || job.status === 'PAYOUT_PENDING');
  const pendingPayout = sum(workerJobs.filter((job) => job.status === 'PAYOUT_PENDING').map((job) => job.workerPayable));
  const weekEarnings = sum(completedJobs.map((job) => job.workerPayable));

  if (activeTab === 'Home') {
    return (
      <View>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Good morning, Alex</Text>
            <Text style={styles.subtle}>Worker App dashboard</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>AM</Text></View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.cardTitle}>Availability</Text>
              <Text style={styles.subtle}>{worker.available ? 'Visible in customer search results' : 'Hidden from new bookings'}</Text>
            </View>
            <TouchableOpacity style={worker.available ? styles.successButton : styles.secondaryButtonSmall} onPress={() => onSetAvailability(!worker.available)}>
              <Text style={worker.available ? styles.successButtonText : styles.secondaryButtonText}>
                {worker.available ? 'Available' : 'Unavailable'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.darkCard}>
          <Text style={styles.darkTitle}>Summary</Text>
          <View style={styles.metricRow}>
            <Metric value={`${requestJobs.length}`} label="New requests" />
            <Metric value="1" label="Jobs today" />
            <Metric value="6" label="Jobs this week" />
          </View>
          <View style={styles.metricRowSpaced}>
            <Metric value={`$${money(weekEarnings || 446.4)}`} label="Earnings this week" />
            <Metric value={`$${money(pendingPayout || 148.8)}`} label="Pending payout" />
          </View>
        </View>

        {nextJob ? (
          <JobCard
            job={nextJob}
            data={data}
            revealAddress
            title="Next Job"
            actions={<JobActions job={nextJob} onNavigate={onNavigate} onArrived={onArrived} onStart={onStart} onComplete={onComplete} onWorkerReview={onWorkerReview} onIssue={onIssue} />}
          />
        ) : (
          <EmptyState title="No upcoming jobs" message="You have no scheduled jobs." />
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>New Request Preview</Text>
          {requestJobs.length === 0 && <Text style={styles.subtle}>You do not have any new requests right now. Keep your availability turned on to receive bookings.</Text>}
          {requestJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              data={data}
              title="Pending request"
              actions={<RequestActions jobId={job.id} onAccept={onAccept} onReject={onReject} />}
            />
          ))}
        </View>
      </View>
    );
  }

  if (activeTab === 'Jobs') {
    const filteredJobs = filterJobs(workerJobs, jobFilter);
    return (
      <View>
        <SegmentedControl options={jobFilters} selected={jobFilter} onSelect={(filter) => onChangeFilter(filter as JobFilter)} />
        {filteredJobs.length === 0 && <EmptyState title={`No ${jobFilter.toLowerCase()} jobs`} message="Jobs will appear here as their status changes." />}
        {filteredJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            data={data}
            revealAddress={job.status !== 'REQUESTED'}
            title={jobFilter}
            actions={job.status === 'REQUESTED'
              ? <RequestActions jobId={job.id} onAccept={onAccept} onReject={onReject} />
              : <JobActions job={job} onNavigate={onNavigate} onArrived={onArrived} onStart={onStart} onComplete={onComplete} onWorkerReview={onWorkerReview} onIssue={onIssue} />}
          />
        ))}
      </View>
    );
  }

  if (activeTab === 'Earnings') {
    return (
      <View>
        <View style={styles.darkCard}>
          <Text style={styles.darkTitle}>Earnings Dashboard</Text>
          <View style={styles.metricRow}>
            <Metric value="$74.40" label="Today" />
            <Metric value={`$${money(weekEarnings || 446.4)}`} label="This week" />
            <Metric value="$1,184.20" label="This month" />
          </View>
          <View style={styles.metricRowSpaced}>
            <Metric value={`$${money(pendingPayout || 148.8)}`} label="Pending payout" />
            <Metric value="$3,842.00" label="Lifetime" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transactions</Text>
          {completedJobs.map((job) => (
            <View key={job.id} style={styles.transactionRow}>
              <View>
                <Text style={styles.rowTitle}>{serviceName(data, job.serviceId)} — {customerFirstName(data, job.customerId)}</Text>
                <Text style={styles.subtle}>Completed: {job.date}</Text>
              </View>
              <View style={styles.rightAlign}>
                <Text style={styles.amountText}>${money(job.workerPayable)}</Text>
                <Text style={styles.subtle}>{job.payoutStatus}</Text>
              </View>
            </View>
          ))}
          {completedJobs.length === 0 && <EmptyState title="No earnings" message="Your earnings will appear here after you complete your first job." />}
          <Text style={styles.safeNote}>Worker view shows only final payable earnings after platform deduction.</Text>
        </View>

        <PerformanceCard worker={worker} />
      </View>
    );
  }

  if (activeTab === 'Notifications') {
    return (
      <View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notifications</Text>
          {data.workerNotifications.map((notification) => (
            <View key={notification.id} style={styles.notificationRow}>
              <Text style={styles.rowTitle}>{notification.title}</Text>
              <Text style={styles.subtle}>{notification.message}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return <WorkerProfileScreen worker={worker} data={data} onEditProfile={onEditProfile} />;
}

function CustomerDemo({
  data,
  activeTab,
  onRequest,
  onAddToCart,
  onRemoveCartItem,
  onCheckout,
  onAcceptTerms,
  onCustomerReview,
}: {
  data: DemoState;
  activeTab: CustomerTab;
  onRequest: () => void;
  onAddToCart: (workerId: string, serviceId: string) => void;
  onRemoveCartItem: (cartItemId: string) => void;
  onCheckout: () => void;
  onAcceptTerms: () => void;
  onCustomerReview: (jobId: string) => void;
}) {
  const [serviceFilter, setServiceFilter] = useState('cleaning');
  const customer = data.customers.find((item) => item.id === 'customer_demo') ?? data.customers[0];
  const customerJobs = data.jobs.filter((job) => job.customerId === customer.id);
  const customerBookings = data.masterBookings.filter((booking) => booking.customerId === customer.id);
  const todayJobs = customerJobs.filter((job) => job.date === 'Today');
  const activeBookings = customerJobs.filter((job) => !['PAID', 'REJECTED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_WORKER'].includes(job.status));
  const workers = data.workers.filter((worker) => worker.profileStatus === 'Approved' && worker.available && worker.services.includes(serviceFilter));
  const serviceOptions = data.services.filter((service) => service.active).map((service) => service.id);

  if (activeTab === 'Home') {
    const nextBooking = activeBookings[0];
    return (
      <View>
        <ScreenTitle title="Customer home" subtitle="Sign in, book trusted help, track today's jobs, and share OTPs with the worker at start and finish." />
        {!data.termsAccepted.customer && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Terms and Conditions</Text>
            <Text style={styles.subtle}>Customer must acknowledge terms before proceeding with real checkout. This demo records the consent event in status history.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={onAcceptTerms}>
              <Text style={styles.primaryButtonText}>Accept Terms and Continue</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer signup / login</Text>
          <Text style={styles.subtle}>Available demo methods: Google, Apple, Facebook, LinkedIn, email/password, or OTP.</Text>
          <View style={styles.authGrid}>
            {['Google', 'Apple', 'Facebook', 'LinkedIn', 'Email', 'OTP'].map((method) => (
              <FeaturePill key={method} title={method} />
            ))}
          </View>
        </View>
        <View style={styles.darkCard}>
          <Text style={styles.darkTitle}>Booking snapshot</Text>
          <View style={styles.metricRow}>
            <Metric value={`${customerBookings.length}`} label="Master bookings" />
            <Metric value={`${todayJobs.length}`} label="Today's jobs" />
            <Metric value={`${activeBookings.length}`} label="Active" />
          </View>
        </View>
        {nextBooking ? (
          <CustomerBookingCard data={data} job={nextBooking} onCustomerReview={onCustomerReview} />
        ) : (
          <EmptyState title="No active bookings" message="Book a worker from the Jobs tab to start the demo flow." />
        )}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer notifications</Text>
          {data.customerNotifications.length === 0 && <Text style={styles.subtle}>Booking updates will appear here after requests, acceptance, arrival and completion.</Text>}
          {data.customerNotifications.map((notification) => (
            <View key={notification.id} style={styles.notificationRow}>
              <Text style={styles.rowTitle}>{notification.title}</Text>
              <Text style={styles.subtle}>{notification.message}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (activeTab === 'Jobs') {
    return (
      <View>
        <ScreenTitle title="Available jobs and workers" subtitle="Filter by service, add one or more workers to the cart, then checkout to create a master booking." />
        <SegmentedControl options={serviceOptions} selected={serviceFilter} onSelect={setServiceFilter} />
        {workers.map((worker) => (
          <CustomerWorkerCard
            key={worker.id}
            worker={worker}
            data={data}
            serviceId={serviceFilter}
            onAddToCart={() => onAddToCart(worker.id, serviceFilter)}
            onRequest={worker.id === 'worker_alex' ? onRequest : undefined}
          />
        ))}
        {workers.length === 0 && <EmptyState title="No workers found" message="Try another service filter." />}
        <CartSummary data={data} onRemoveCartItem={onRemoveCartItem} onCheckout={onCheckout} />
      </View>
    );
  }

  if (activeTab === 'Bookings') {
    return (
      <View>
        <ScreenTitle title="My bookings" subtitle="Track requests, accepted jobs, jobs in progress, OTP handoff, completion and reviews." />
        {customerBookings.length === 0 && <EmptyState title="No bookings yet" message="Send a request from the Jobs tab." />}
        {customerBookings.map((booking) => (
          <MasterBookingCard key={booking.id} data={data} booking={booking} />
        ))}
        {customerJobs.map((job) => (
          <CustomerBookingCard key={job.id} data={data} job={job} onCustomerReview={onCustomerReview} />
        ))}
      </View>
    );
  }

  return <CustomerProfileScreen customer={customer} data={data} />;
}

function CustomerWorkerCard({
  worker,
  data,
  serviceId,
  onAddToCart,
  onRequest,
}: {
  worker: WorkerProfile;
  data: DemoState;
  serviceId: string;
  onAddToCart: () => void;
  onRequest?: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.workerResult}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(worker.name)}</Text></View>
        <View style={styles.workerResultText}>
          <Text style={styles.rowTitle}>{worker.name}</Text>
          <Text style={styles.subtle}>{worker.services.map((id) => serviceName(data, id)).join(', ')}</Text>
          <Text style={styles.subtle}>${serviceRate(data, serviceId)}/hour · {worker.rating} stars · {worker.completedJobs} jobs</Text>
          <Text style={styles.subtle}>{worker.bio}</Text>
        </View>
      </View>
      <Detail label="Availability" value={worker.availability[0]} />
      <Detail label="Service area" value={`${worker.baseLocation} · ${worker.radiusKm} km`} />
      <TouchableOpacity style={styles.primaryButton} onPress={onAddToCart}>
        <Text style={styles.primaryButtonText}>Add to Cart</Text>
      </TouchableOpacity>
      {onRequest ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={onRequest}>
          <Text style={styles.secondaryButtonText}>Quick Request Alex for Worker Demo</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.safeNote}>Add to cart for master booking checkout.</Text>
      )}
    </View>
  );
}

function CartSummary({
  data,
  onRemoveCartItem,
  onCheckout,
}: {
  data: DemoState;
  onRemoveCartItem: (cartItemId: string) => void;
  onCheckout: () => void;
}) {
  const total = sum(data.cart.map((item) => serviceRate(data, item.serviceId) * item.durationHours));
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Task Cart</Text>
      {data.cart.length === 0 && <Text style={styles.subtle}>Add workers from the list above to create a multi-worker master booking.</Text>}
      {data.cart.map((item) => {
        const worker = data.workers.find((candidate) => candidate.id === item.workerId);
        return (
          <View key={item.id} style={styles.cartRow}>
            <View style={styles.transactionText}>
              <Text style={styles.rowTitle}>{serviceName(data, item.serviceId)} with {worker?.name ?? item.workerId}</Text>
              <Text style={styles.subtle}>{item.date} · {item.time} · {item.durationHours} hours</Text>
              <Text style={styles.subtle}>${money(serviceRate(data, item.serviceId) * item.durationHours)}</Text>
            </View>
            <TouchableOpacity style={styles.miniButton} onPress={() => onRemoveCartItem(item.id)}>
              <Text style={styles.miniButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        );
      })}
      <PaymentStat label="Cart total" value={`$${money(total)}`} />
      <TouchableOpacity style={[styles.primaryButton, data.cart.length === 0 && styles.disabledButton]} disabled={data.cart.length === 0} onPress={onCheckout}>
        <Text style={styles.primaryButtonText}>Checkout and Create Master Booking</Text>
      </TouchableOpacity>
      <Text style={styles.safeNote}>Checkout simulates payment capture, Stripe fee/tax calculation, and child worker assignment creation.</Text>
    </View>
  );
}

function MasterBookingCard({ data, booking, compact = false }: { data: DemoState; booking: DemoState['masterBookings'][number]; compact?: boolean }) {
  const assignments = booking.assignmentIds
    .map((jobId) => data.jobs.find((job) => job.id === jobId))
    .filter(Boolean) as Job[];

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.transactionText}>
          <Text style={styles.cardEyebrow}>Master booking</Text>
          <Text style={styles.rowTitle}>{booking.title}</Text>
          <Text style={styles.subtle}>{booking.date} · {assignments.length} assignment(s)</Text>
        </View>
        <Badge label={booking.status} tone={statusTone(booking.status)} />
      </View>
      <View style={styles.paymentBreakdown}>
        <PaymentStat label="Customer total" value={`$${money(booking.totalCustomerAmount)}`} compact />
        <PaymentStat label="Platform 7%" value={`$${money(booking.totalPlatformCommission)}`} compact />
        {!compact && <PaymentStat label="Worker payable" value={`$${money(booking.totalWorkerPayable)}`} compact />}
        {!compact && <PaymentStat label="Fee / tax" value={`$${money(booking.stripeFees)} / $${money(booking.estimatedTax)}`} compact />}
      </View>
      {assignments.map((job) => (
        <StatusRow key={job.id} label={`${serviceName(data, job.serviceId)} with ${data.workers.find((worker) => worker.id === job.workerId)?.name ?? job.workerId}: ${job.status}`} done={job.status !== 'REQUESTED'} />
      ))}
    </View>
  );
}

function CustomerBookingCard({
  data,
  job,
  onCustomerReview,
}: {
  data: DemoState;
  job: Job;
  onCustomerReview: (jobId: string) => void;
}) {
  const worker = data.workers.find((item) => item.id === job.workerId);
  const canShowStartOtp = job.status === 'ARRIVED' || job.status === 'IN_PROGRESS' || isAfterStart(job.status);
  const canShowEndOtp = job.status === 'IN_PROGRESS' || isAfterComplete(job.status);
  const canReview = job.status === 'PAYOUT_PENDING' || job.status === 'PAID';

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.transactionText}>
          <Text style={styles.cardEyebrow}>Booking</Text>
          <Text style={styles.rowTitle}>{serviceName(data, job.serviceId)} with {worker?.name ?? 'worker'}</Text>
          <Text style={styles.subtle}>{job.date} · {job.time}</Text>
        </View>
        <Badge label={job.status} tone={statusTone(job.status)} />
      </View>
      <Detail label="Address" value={job.address} />
      <Detail label="Payment" value={`${job.paymentStatus} · $${money(job.customerAmount)}`} />
      <Text style={styles.safeNote}>Share OTPs only with the worker in person. The worker must enter them manually in their app.</Text>
      <View style={styles.otpShareRow}>
        <OtpShare label="Start Job OTP" code={job.startOtp} visible={canShowStartOtp} />
        <OtpShare label="End Job OTP" code={job.endOtp} visible={canShowEndOtp} />
      </View>
      <StatusRow label="Request sent to worker" done />
      <StatusRow label="Worker accepted booking" done={job.status !== 'REQUESTED' && job.status !== 'REJECTED'} />
      <StatusRow label="Worker arrived and can ask for Start OTP" done={canShowStartOtp} />
      <StatusRow label="Job in progress and End OTP available at finish" done={canShowEndOtp} />
      {canReview && (
        <TouchableOpacity style={styles.secondaryButton} onPress={() => onCustomerReview(job.id)}>
          <Text style={styles.secondaryButtonText}>{job.customerReview ? 'Customer review submitted' : 'Submit worker rating'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function OtpShare({ label, code, visible }: { label: string; code: string; visible: boolean }) {
  return (
    <View style={[styles.otpShareCard, !visible && styles.otpShareHidden]}>
      <Text style={styles.paymentLabel}>{label}</Text>
      <Text style={styles.otpShareCode}>{visible ? code : 'Hidden'}</Text>
      <Text style={styles.otpHelp}>{visible ? 'Give this to the worker.' : 'Shown only at the right job stage.'}</Text>
    </View>
  );
}

function CustomerProfileScreen({ customer, data }: { customer: { name: string; email: string; rating: number; reviewCount: number; address: string }; data: DemoState }) {
  return (
    <View>
      <View style={styles.darkCard}>
        <Text style={styles.darkTitle}>Customer Profile</Text>
        <View style={styles.metricRow}>
          <Metric value={`${customer.rating}`} label="Rating" />
          <Metric value={`${customer.reviewCount}`} label="Reviews" />
          <Metric value="Verified" label="Status" />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{customer.name}</Text>
        <Detail label="Email" value={customer.email} />
        <Detail label="Primary address" value={customer.address} />
        <Detail label="Payment method" value="Demo Visa ending 4242" />
        <Detail label="Notifications" value="Booking, OTP and payout status alerts enabled" />
      </View>
      <LoyaltyCard title="Customer loyalty" points={data.loyalty.customerPoints} reward={data.loyalty.customerReward} />
      <DeviceSessionsCard data={data} persona="customer" />
    </View>
  );
}

function DeviceSessionsCard({ data, persona }: { data: DemoState; persona: Persona }) {
  const sessions = data.deviceSessions.filter((session) => session.persona === persona);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Devices</Text>
      {sessions.map((session) => (
        <StatusRow key={session.id} label={`${session.device} · ${session.location} · ${session.lastActive}`} done />
      ))}
      <Text style={styles.safeNote}>Session tracking placeholder.</Text>
    </View>
  );
}

function LoyaltyCard({ title, points, reward }: { title: string; points: number; reward: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <PaymentStat label="Current points" value={`${points} pts`} />
      <Text style={styles.safeNote}>{reward}</Text>
    </View>
  );
}

function MarketplaceOpsCard({ data }: { data: DemoState }) {
  const reviewCount = data.jobs.filter((job) => job.customerReview || job.workerReview).length;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Controls</Text>
      <StatusRow label={`Customer terms: ${data.termsAccepted.customer ? 'Accepted' : 'Pending'}`} done={data.termsAccepted.customer} />
      <StatusRow label={`Worker terms: ${data.termsAccepted.worker ? 'Accepted' : 'Pending'}`} done={data.termsAccepted.worker} />
      <StatusRow label="Reminders: Ready" done />
      <StatusRow label={`Reviews: ${reviewCount}`} done={reviewCount > 0} />
      <StatusRow label="Chat: Placeholder" done />
    </View>
  );
}

function AdminDemo({ data, activeTab, onPay }: { data: DemoState; activeTab: AdminTab; onPay: (jobId: string) => void }) {
  const [search, setSearch] = useState('');
  const jobs = data.jobs;
  const completedJobs = jobs.filter((job) => job.status === 'PAYOUT_PENDING' || job.status === 'PAID');
  const gross = sum(jobs.map((job) => job.customerAmount));
  const commission = sum(jobs.map((job) => job.platformCommission));
  const payable = sum(jobs.map((job) => job.workerPayable));
  const issues = jobs.filter((job) => Boolean(job.issueReport));
  const filteredBookings = data.masterBookings.filter((booking) => {
    const haystack = [
      booking.id,
      booking.title,
      data.customers.find((customer) => customer.id === booking.customerId)?.name ?? '',
      ...booking.assignmentIds.flatMap((jobId) => {
        const job = data.jobs.find((item) => item.id === jobId);
        if (!job) {
          return [];
        }
        return [
          serviceName(data, job.serviceId),
          data.workers.find((worker) => worker.id === job.workerId)?.name ?? '',
          job.status,
        ];
      }),
    ].join(' ').toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  if (activeTab === 'Home') {
    return (
      <View>
        <ScreenTitle title="Admin home" subtitle="Live marketplace snapshot." />
        <View style={styles.iconGrid}>
          <IconMetric icon="W" value={`${data.workers.length}`} label="Workers" />
          <IconMetric icon="C" value={`${data.customers.length}`} label="Customers" />
          <IconMetric icon="B" value={`${data.masterBookings.length}`} label="Bookings" />
          <IconMetric icon="7%" value={`$${money(commission)}`} label="Commission" />
        </View>
        <MarketplaceOpsCard data={data} />
      </View>
    );
  }

  if (activeTab === 'Bookings') {
    return (
      <View>
        <ScreenTitle title="Bookings" subtitle="Search master bookings and assignments." />
        <View style={styles.card}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search customer, worker, service"
            placeholderTextColor={colors.muted}
          />
        </View>
        {filteredBookings.length === 0 && <EmptyState title="No matches" message="Try another search." />}
        {filteredBookings.map((booking) => (
          <MasterBookingCard key={booking.id} data={data} booking={booking} compact />
        ))}
      </View>
    );
  }

  if (activeTab === 'Revenue') {
    return (
      <View>
        <ScreenTitle title="Revenue" subtitle="Platform split and payouts." />
        <View style={styles.iconGrid}>
          <IconMetric icon="$" value={`$${money(gross)}`} label="Gross" />
          <IconMetric icon="7%" value={`$${money(commission)}`} label="Platform" />
          <IconMetric icon="P" value={`$${money(payable)}`} label="Payable" />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payouts</Text>
          {completedJobs.map((job) => (
            <View key={job.id} style={styles.paymentJobCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.transactionText}>
                  <Text style={styles.rowTitle}>{serviceName(data, job.serviceId)} · {customerFirstName(data, job.customerId)}</Text>
                  <Text style={styles.subtle}>${money(job.workerPayable)} payable</Text>
                </View>
                <Badge label={job.payoutStatus} tone={job.payoutStatus === 'Paid' ? 'good' : 'warn'} />
              </View>
              {job.status === 'PAYOUT_PENDING' && (
                <TouchableOpacity style={styles.primaryButton} onPress={() => onPay(job.id)}>
                  <Text style={styles.primaryButtonText}>Mark Paid</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (activeTab === 'Reports') {
    return (
      <View>
        <ScreenTitle title="Reports" subtitle="Issues and review moderation." />
        <View style={styles.iconGrid}>
          <IconMetric icon="!" value={`${issues.length}`} label="Issues" />
          <IconMetric icon="R" value={`${jobs.filter((job) => job.customerReview || job.workerReview).length}`} label="Reviews" />
          <IconMetric icon="S" value={`${data.statusHistory.length}`} label="Status logs" />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review Queue</Text>
          {jobs.filter((job) => job.customerReview || job.workerReview).map((job) => (
            <StatusRow key={job.id} label={`${serviceName(data, job.serviceId)} · review captured`} done />
          ))}
          {issues.length === 0 && <Text style={styles.subtle}>No open issue reports.</Text>}
          {issues.map((job) => <StatusRow key={job.id} label={`${serviceName(data, job.serviceId)} · ${job.issueReport}`} done={false} />)}
        </View>
      </View>
    );
  }

  return (
    <View>
      <ScreenTitle title="Ops" subtitle="Security, sessions, terms and rewards." />
      <MarketplaceOpsCard data={data} />
      <DeviceSessionsCard data={data} persona="admin" />
      <LoyaltyCard title="Rewards" points={data.loyalty.customerPoints + data.loyalty.workerPoints} reward="Customer discounts and worker priority listing placeholders." />
    </View>
  );
}

function WorkerProfileScreen({ worker, data, onEditProfile }: { worker: WorkerProfile; data: DemoState; onEditProfile: () => void }) {
  return (
    <View>
      <View style={styles.darkCard}>
        <Text style={styles.darkTitle}>Worker Profile</Text>
        <View style={styles.metricRow}>
          <Metric value={`${worker.rating}`} label="Rating" />
          <Metric value={`${worker.completedJobs}`} label="Completed" />
          <Metric value={worker.profileStatus} label="Status" />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{worker.name}</Text>
        <Detail label="Bio" value={worker.bio} />
        <Detail label="Contact" value={`${worker.email} · ${worker.phone}`} />
        <Detail label="Address" value={`${worker.city}, ${worker.province} ${worker.postalCode}`} />
        <Detail label="Service area" value={`${worker.baseLocation} · ${worker.radiusKm} km`} />
        <Detail label="Language" value={worker.language} />
        <Detail label="Verification" value={worker.verificationStatus} />
        <Detail label="Payout" value={`${worker.payoutMethod} ${worker.payoutAccount}`} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Services and fixed rates</Text>
        {worker.services.map((serviceId) => (
          <FeaturePill key={serviceId} title={`${serviceName(data, serviceId)} · $${serviceRate(data, serviceId)}/hour`} />
        ))}
        <Text style={styles.safeNote}>Rates are currently set by Help Me Today.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Skills and Availability</Text>
        {Object.entries(worker.skills).map(([serviceId, description]) => (
          <Detail key={serviceId} label={serviceName(data, serviceId)} value={description} />
        ))}
        {worker.availability.map((slot) => <StatusRow key={slot} label={slot} done />)}
        <Detail label="Same-day booking" value={worker.sameDay ? 'Enabled' : 'Disabled'} />
        <Detail label="Max jobs per day" value={`${worker.maxJobsPerDay}`} />
        <TouchableOpacity style={styles.primaryButton} onPress={onEditProfile}>
          <Text style={styles.primaryButtonText}>Edit Profile / Availability</Text>
        </TouchableOpacity>
      </View>
      <LoyaltyCard title="Worker loyalty" points={data.loyalty.workerPoints} reward={data.loyalty.workerReward} />
      <DeviceSessionsCard data={data} persona="worker" />
    </View>
  );
}

function JobCard({
  job,
  data,
  title,
  revealAddress = false,
  actions,
}: {
  job: Job;
  data: DemoState;
  title: string;
  revealAddress?: boolean;
  actions?: React.ReactNode;
}) {
  const customer = data.customers.find((item) => item.id === job.customerId);
  const masterBooking = data.masterBookings.find((booking) => booking.id === job.masterBookingId);
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.transactionText}>
          <Text style={styles.cardEyebrow}>{title} assignment</Text>
          <Text style={styles.rowTitle}>{serviceName(data, job.serviceId)}</Text>
          <Text style={styles.subtle}>Customer: {customer?.name ?? job.customerId} · Rating {customer?.rating ?? '4.8'}</Text>
        </View>
        <Badge label={job.status} tone={statusTone(job.status)} />
      </View>
      {masterBooking && <Detail label="Master booking" value={`${masterBooking.id} · ${masterBooking.status}`} />}
      <Detail label="Date and time" value={`${job.date} · ${job.time}`} />
      <Detail label="Duration" value={`${job.durationHours} hours`} />
      <Detail label={revealAddress ? 'Address' : 'Approximate location'} value={revealAddress ? job.address : job.approximateLocation} />
      <Detail label="Instructions" value={job.instructions} />
      <Detail label="Tools / equipment" value={job.requestedTools} />
      <Detail label="Your earnings" value={`$${money(job.workerPayable)}`} />
      {job.checkInLocation && <Detail label="Check-in location" value={job.checkInLocation} />}
      {job.checkOutLocation && <Detail label="Check-out location" value={job.checkOutLocation} />}
      <Text style={styles.safeNote}>Worker view hides platform commission.</Text>
      {actions}
    </View>
  );
}

function RequestActions({ jobId, onAccept, onReject }: { jobId: string; onAccept: (jobId: string) => void; onReject: (jobId: string) => void }) {
  return (
    <View>
      <TouchableOpacity style={styles.primaryButton} onPress={() => onAccept(jobId)}>
        <Text style={styles.primaryButtonText}>Accept Request</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => onReject(jobId)}>
        <Text style={styles.secondaryButtonText}>Reject Request</Text>
      </TouchableOpacity>
    </View>
  );
}

function JobActions({
  job,
  onNavigate,
  onArrived,
  onStart,
  onComplete,
  onWorkerReview,
  onIssue,
}: {
  job: Job;
  onNavigate: (jobId: string) => void;
  onArrived: (jobId: string) => void;
  onStart: (jobId: string) => void;
  onComplete: (jobId: string) => void;
  onWorkerReview: (jobId: string) => void;
  onIssue: (jobId: string) => void;
}) {
  const [otpStep, setOtpStep] = useState<'none' | 'start' | 'end'>('none');

  if (job.status === 'SCHEDULED') {
    return (
      <View>
        <TouchableOpacity style={styles.primaryButton} onPress={() => onNavigate(job.id)}>
          <Text style={styles.primaryButtonText}>Navigate / On My Way</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Contact Customer</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (job.status === 'EN_ROUTE') {
    return <TouchableOpacity style={styles.primaryButton} onPress={() => onArrived(job.id)}><Text style={styles.primaryButtonText}>I Have Arrived</Text></TouchableOpacity>;
  }
  if (job.status === 'ARRIVED') {
    return (
      <View>
        <OtpPrompt
          title="Start Job OTP Required"
          instruction="Ask the customer for the Start Job OTP displayed in their app before beginning work."
          otp="1234"
          visible={otpStep === 'start'}
          onOpen={() => setOtpStep('start')}
          onVerify={() => onStart(job.id)}
          buttonLabel="Verify & Start Job"
        />
      </View>
    );
  }
  if (job.status === 'IN_PROGRESS') {
    return (
      <View>
        <Detail label="Start time" value={job.actualStartAt ?? 'Stored start timestamp'} />
        <Detail label="Elapsed time" value="01:12:00 calculated from start timestamp" />
        <Text style={styles.otpInstruction}>When the service is complete, ask the customer for the End Job OTP before closing the job.</Text>
        <OtpPrompt
          title="End Job OTP Required"
          instruction="Confirm the service is complete, then enter the End Job OTP shown in the customer app."
          otp="5678"
          visible={otpStep === 'end'}
          onOpen={() => setOtpStep('end')}
          onVerify={() => onComplete(job.id)}
          buttonLabel="Verify & Complete Job"
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={() => onIssue(job.id)}>
          <Text style={styles.secondaryButtonText}>Report an Issue</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (job.status === 'PAYOUT_PENDING' || job.status === 'PAID') {
    return (
      <TouchableOpacity style={styles.primaryButton} onPress={() => onWorkerReview(job.id)}>
        <Text style={styles.primaryButtonText}>{job.workerReview ? 'Worker Review Submitted' : 'Review Customer'}</Text>
      </TouchableOpacity>
    );
  }
  return null;
}

function OtpPrompt({
  title,
  instruction,
  otp,
  visible,
  onOpen,
  onVerify,
  buttonLabel,
}: {
  title: string;
  instruction: string;
  otp: string;
  visible: boolean;
  onOpen: () => void;
  onVerify: () => void;
  buttonLabel: string;
}) {
  const [enteredOtp, setEnteredOtp] = useState('');
  const [error, setError] = useState('');

  if (!visible) {
    return (
      <TouchableOpacity style={styles.primaryButton} onPress={onOpen}>
        <Text style={styles.primaryButtonText}>Enter OTP</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.otpCard}>
      <Text style={styles.otpTitle}>{title}</Text>
      <Text style={styles.otpInstruction}>{instruction}</Text>
      <TextInput
        style={styles.otpInput}
        value={enteredOtp}
        onChangeText={(text) => {
          setEnteredOtp(text.replace(/\D/g, '').slice(0, 4));
          setError('');
        }}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="Enter 4-digit OTP"
        placeholderTextColor={colors.muted}
      />
      {error ? <Text style={styles.otpError}>{error}</Text> : <Text style={styles.otpHelp}>Demo valid OTP is shared from the customer app.</Text>}
      <TouchableOpacity
        style={[styles.primaryButton, enteredOtp.length < 4 && styles.disabledButton]}
        disabled={enteredOtp.length < 4}
        onPress={() => {
          if (enteredOtp === otp) {
            onVerify();
            return;
          }
          setError('Invalid OTP. Ask the customer to confirm the code and try again.');
        }}
      >
        <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PerformanceCard({ worker }: { worker: WorkerProfile }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Performance</Text>
      <Detail label="Average rating" value={`${worker.rating}`} />
      <Detail label="Completed jobs" value={`${worker.completedJobs}`} />
      <Detail label="Acceptance rate" value="92%" />
      <Detail label="Cancellation rate" value="3%" />
      <Detail label="Repeat customers" value="6" />
    </View>
  );
}

function AppHeader({
  persona,
  session,
  message,
  onBack,
  onReset,
}: {
  persona: Persona;
  session: { name: string };
  message: string;
  onBack: () => void;
  onReset: () => void;
}) {
  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{titleCase(persona)} App</Text>
          <Text style={styles.subtle}>{session.name} · $ · Canada demo</Text>
        </View>
        <Image source={logo} style={styles.headerLogo} resizeMode="contain" />
      </View>
      <View style={styles.statusBanner}>
        <Text style={styles.statusBannerText}>{message}</Text>
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.secondaryButtonSmall} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Switch persona</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButtonSmall} onPress={onReset}>
          <Text style={styles.secondaryButtonText}>Reset demo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.loadingScreen}><Text style={styles.rowTitle}>{message}</Text></View>
    </SafeAreaView>
  );
}

function ScreenTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.subtle}>{subtitle}</Text>
    </View>
  );
}

function PersonaOption({ title, description, cta, onPress }: { title: string; description: string; cta: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.optionRow} onPress={onPress}>
      <View style={styles.optionText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.subtle}>{description}</Text>
      </View>
      <View style={styles.actionPill}><Text style={styles.actionPillText}>{cta}</Text></View>
    </TouchableOpacity>
  );
}

function BottomNav<T extends string>({ tabs, active, onSelect }: { tabs: readonly T[]; active: T; onSelect: (tab: T) => void }) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity key={tab} style={[styles.tabItem, tab === active && styles.tabItemActive]} onPress={() => onSelect(tab)}>
          <Text style={[styles.tabIcon, tab === active && styles.tabLabelActive]}>{tabIcon(tab)}</Text>
          <Text style={[styles.tabLabel, tab === active && styles.tabLabelActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function tabIcon(tab: string): string {
  const icons: Record<string, string> = {
    Home: 'H',
    Jobs: 'J',
    Earnings: '$',
    Notifications: 'N',
    Profile: 'ID',
    Bookings: 'B',
    Revenue: '$',
    Reports: '!',
    Ops: '*',
  };
  return icons[tab] ?? tab.slice(0, 1).toUpperCase();
}

function SegmentedControl<T extends string>({ options, selected, onSelect }: { options: readonly T[]; selected: T; onSelect: (tab: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentScroll}>
      <View style={styles.segmented}>
        {options.map((option) => (
          <TouchableOpacity key={option} style={[styles.segment, option === selected && styles.segmentActive]} onPress={() => onSelect(option)}>
            <Text style={[styles.segmentText, option === selected && styles.segmentTextActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function IconMetric({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.iconMetric}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <Text style={styles.iconMetricValue}>{value}</Text>
      <Text style={styles.iconMetricLabel}>{label}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function PaymentStat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <View style={[styles.paymentStat, compact && styles.paymentStatCompact]}>
      <Text style={styles.paymentLabel}>{label}</Text>
      <Text style={styles.paymentValue}>{value}</Text>
    </View>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, done && styles.statusDotDone]} />
      <Text style={[styles.statusText, done && styles.statusTextDone]}>{label}</Text>
    </View>
  );
}

function FeaturePill({ title }: { title: string }) {
  return (
    <View style={styles.featurePill}>
      <Text style={styles.featureText}>{title}</Text>
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: 'good' | 'warn' | 'danger' }) {
  return (
    <View style={[styles.badge, tone === 'good' && styles.badgeGood, tone === 'danger' && styles.badgeDanger]}>
      <Text style={[styles.badgeText, tone === 'danger' && styles.badgeTextDanger]}>{label.replaceAll('_', ' ')}</Text>
    </View>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.subtle}>{message}</Text>
    </View>
  );
}

function BackendStatus({ message }: { message: string }) {
  return <View style={styles.statusBanner}><Text style={styles.statusBannerText}>{message}</Text></View>;
}

function demoWorker(data: DemoState): WorkerProfile {
  return data.workers.find((worker) => worker.id === 'worker_alex') ?? data.workers[0];
}

function filterJobs(jobs: Job[], filter: JobFilter): Job[] {
  const statusMap: Record<JobFilter, JobStatus[]> = {
    Requests: ['REQUESTED'],
    Upcoming: ['SCHEDULED', 'ACCEPTED'],
    'In Progress': ['EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'],
    Completed: ['COMPLETED', 'PAYOUT_PENDING', 'PAID'],
    Cancelled: ['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_WORKER', 'REJECTED'],
  };
  return jobs.filter((job) => statusMap[filter].includes(job.status));
}

function statusTone(status: JobStatus): 'good' | 'warn' | 'danger' {
  if (status === 'PAID' || status === 'COMPLETED' || status === 'PAYOUT_PENDING') return 'good';
  if (status.includes('CANCELLED') || status === 'REJECTED' || status === 'PAYMENT_PENDING') return 'danger';
  return 'warn';
}

function serviceName(data: DemoState, serviceId: string): string {
  return data.services.find((service) => service.id === serviceId)?.name ?? serviceId;
}

function serviceRate(data: DemoState, serviceId: string): number {
  return data.services.find((service) => service.id === serviceId)?.hourlyRate ?? 0;
}

function customerFirstName(data: DemoState, customerId: string): string {
  return data.customers.find((customer) => customer.id === customerId)?.name.split(' ')[0] ?? customerId;
}

function isAfterStart(status: JobStatus): boolean {
  return status === 'COMPLETED' || status === 'PAYOUT_PENDING' || status === 'PAID';
}

function isAfterComplete(status: JobStatus): boolean {
  return status === 'COMPLETED' || status === 'PAYOUT_PENDING' || status === 'PAID';
}

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function money(value: number): string {
  return value.toFixed(2);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  screen: {
    padding: 20,
    paddingBottom: 112,
  },
  loadingScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 12,
  },
  logo: {
    height: 150,
    marginBottom: 8,
    width: 150,
  },
  kicker: {
    color: colors.moss,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
    textAlign: 'center',
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 14,
    textAlign: 'center',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 12,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  headerLogo: {
    borderRadius: 18,
    height: 58,
    width: 58,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  greeting: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  cardEyebrow: {
    color: colors.moss,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  subtle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  safeNote: {
    color: colors.moss,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 10,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  authGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  iconMetric: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '47%',
    padding: 14,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: colors.sage,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginBottom: 8,
    width: 36,
  },
  iconText: {
    color: colors.forest,
    fontSize: 12,
    fontWeight: '900',
  },
  iconMetricValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  iconMetricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'center',
  },
  optionRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 14,
  },
  optionText: {
    flex: 1,
    paddingRight: 12,
  },
  actionPill: {
    alignItems: 'center',
    backgroundColor: colors.sage,
    borderRadius: 999,
    minWidth: 82,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionPillText: {
    color: colors.forest,
    fontSize: 11,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.forest,
    borderRadius: 14,
    marginTop: 14,
    paddingVertical: 15,
  },
  disabledButton: {
    backgroundColor: colors.muted,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.forest,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 14,
  },
  secondaryButtonSmall: {
    alignItems: 'center',
    borderColor: colors.forest,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: colors.forest,
    fontSize: 13,
    fontWeight: '900',
  },
  successButton: {
    alignItems: 'center',
    backgroundColor: colors.forest,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  successButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  miniButton: {
    backgroundColor: colors.forest,
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  miniButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  statusBanner: {
    backgroundColor: colors.sage,
    borderRadius: 18,
    marginBottom: 16,
    padding: 14,
  },
  statusBannerText: {
    color: colors.forest,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  otpCard: {
    backgroundColor: colors.sage,
    borderRadius: 20,
    marginTop: 14,
    padding: 16,
  },
  otpTitle: {
    color: colors.forest,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  otpInstruction: {
    color: colors.moss,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 10,
  },
  otpInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 8,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'center',
  },
  otpHelp: {
    color: colors.moss,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 8,
  },
  otpError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
    marginTop: 8,
  },
  otpShareRow: {
    gap: 10,
    marginBottom: 12,
    marginTop: 12,
  },
  otpShareCard: {
    backgroundColor: colors.sage,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  otpShareHidden: {
    backgroundColor: '#ffffff',
  },
  otpShareCode: {
    color: colors.forest,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 6,
  },
  otpDigits: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 14,
  },
  otpDigitBox: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  otpDigitText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  darkCard: {
    backgroundColor: colors.forest,
    borderRadius: 24,
    marginBottom: 16,
    padding: 18,
  },
  darkTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricRowSpaced: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  metric: {
    flex: 1,
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#d9e1d7',
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
  },
  detailLabel: {
    color: colors.muted,
    flex: 0.9,
    fontSize: 13,
    paddingRight: 8,
  },
  detailValue: {
    color: colors.text,
    flex: 1.2,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  paymentGrid: {
    gap: 10,
  },
  paymentBreakdown: {
    gap: 8,
    marginTop: 12,
  },
  paymentJobCard: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  paymentStat: {
    backgroundColor: colors.sage,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paymentStatCompact: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  paymentLabel: {
    color: colors.moss,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  paymentValue: {
    color: colors.forest,
    fontSize: 18,
    fontWeight: '900',
  },
  cartRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    padding: 12,
  },
  timelineBox: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 11,
  },
  statusDot: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    marginRight: 10,
    width: 18,
  },
  statusDotDone: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  statusText: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
  },
  statusTextDone: {
    color: colors.text,
    fontWeight: '800',
  },
  featurePill: {
    backgroundColor: colors.sage,
    borderRadius: 999,
    marginBottom: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  featureText: {
    color: colors.forest,
    fontSize: 13,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: colors.sage,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeGood: {
    backgroundColor: '#dcebd7',
  },
  badgeDanger: {
    backgroundColor: '#f3ddd5',
  },
  badgeText: {
    color: colors.forest,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  badgeTextDanger: {
    color: colors.danger,
  },
  segmentScroll: {
    marginBottom: 16,
  },
  segmented: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 5,
  },
  segment: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  segmentActive: {
    backgroundColor: colors.forest,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  workerResult: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginBottom: 14,
  },
  workerResultText: {
    flex: 1,
    paddingLeft: 12,
  },
  transactionRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  transactionText: {
    flex: 1,
    paddingRight: 10,
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  amountText: {
    color: colors.forest,
    fontSize: 14,
    fontWeight: '900',
  },
  notificationRow: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  emptyState: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  tabBar: {
    backgroundColor: '#fffaf4',
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    bottom: 24,
    flexDirection: 'row',
    left: 16,
    padding: 6,
    position: 'absolute',
    right: 16,
  },
  tabItem: {
    alignItems: 'center',
    borderRadius: 20,
    flex: 1,
    paddingVertical: 11,
  },
  tabItemActive: {
    backgroundColor: colors.forest,
  },
  tabIcon: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 2,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  tabLabelActive: {
    color: '#ffffff',
  },
});
