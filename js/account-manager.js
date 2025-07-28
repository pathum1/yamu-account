// Account Management functionality for YAMU
// This mirrors the AccountManagementService from the Flutter app

class AccountManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const exportDataBtn = document.getElementById('export-data-btn');
        const deleteAccountBtn = document.getElementById('delete-account-btn');

        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => this.handleDataExport());
        }

        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => this.handleAccountDeletion());
        }
    }

    // Load and display user data summary
    async loadUserDataSummary() {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const summary = await this.getUserDataSummary();
            this.displayDataSummary(summary);
        } catch (error) {
            console.error('Failed to load user data summary:', error);
        }
    }

    // Get user data summary (mirrors Flutter implementation)
    async getUserDataSummary() {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No authenticated user found');
        }

        const summary = {};

        try {
            // Count trips (both owned and participated)
            const [ownerTrips, participantTrips] = await Promise.all([
                firestore.collection('road_trips').where('ownerUid', '==', user.uid).get(),
                firestore.collection('road_trips').where('participants', 'array-contains', user.uid).get()
            ]);

            const uniqueTripIds = new Set();
            ownerTrips.docs.forEach(doc => uniqueTripIds.add(doc.id));
            participantTrips.docs.forEach(doc => uniqueTripIds.add(doc.id));

            summary.tripsCount = uniqueTripIds.size;
            summary.ownedTripsCount = ownerTrips.docs.length;

            // Count friends
            const friendsQuery = await firestore
                .collection('friendships')
                .where('users', 'array-contains', user.uid)
                .where('status', '==', 'active')
                .get();
            summary.friendsCount = friendsQuery.docs.length;

            // Count achievements
            try {
                const achievementsDoc = await firestore.collection('achievements').doc(user.uid).get();
                if (achievementsDoc.exists) {
                    const data = achievementsDoc.data();
                    summary.achievementsCount = Object.keys(data || {}).length;
                } else {
                    summary.achievementsCount = 0;
                }
            } catch (e) {
                summary.achievementsCount = 0;
            }

            // Count comments
            try {
                const commentsQuery = await firestore
                    .collectionGroup('comments')
                    .where('userId', '==', user.uid)
                    .get();
                summary.commentsCount = commentsQuery.docs.length;
            } catch (e) {
                summary.commentsCount = 0;
            }

            // Account creation date
            summary.accountCreated = user.metadata.creationTime;
            summary.lastSignIn = user.metadata.lastSignInTime;

            return summary;
        } catch (error) {
            console.error('Failed to get user data summary:', error);
            throw new Error('Failed to get user data summary');
        }
    }

    // Display data summary in UI
    displayDataSummary(summary) {
        const summarySection = document.getElementById('data-summary');
        const summaryContent = document.getElementById('summary-content');

        if (!summaryContent) return;

        const formatDate = (date) => {
            if (!date) return 'Unknown';
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        summaryContent.innerHTML = `
            <div class="summary-item">
                <span class="summary-label">Total Trips</span>
                <span class="summary-value">${summary.tripsCount || 0}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Trips You Own</span>
                <span class="summary-value">${summary.ownedTripsCount || 0}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Friends</span>
                <span class="summary-value">${summary.friendsCount || 0}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Achievements</span>
                <span class="summary-value">${summary.achievementsCount || 0}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Comments</span>
                <span class="summary-value">${summary.commentsCount || 0}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Account Created</span>
                <span class="summary-value">${formatDate(summary.accountCreated)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Last Sign In</span>
                <span class="summary-value">${formatDate(summary.lastSignIn)}</span>
            </div>
        `;

        summarySection.classList.remove('hidden');
    }

    // Handle data export
    async handleDataExport() {
        try {
            const modal = document.getElementById('modal');
            const modalTitle = document.getElementById('modal-title');
            const modalMessage = document.getElementById('modal-message');
            const modalConfirm = document.getElementById('modal-confirm');
            const modalCancel = document.getElementById('modal-cancel');

            modalTitle.textContent = 'Export Your Data';
            modalMessage.innerHTML = `
                <p>This will create a complete export of all your YAMU data including:</p>
                <ul style="margin: 16px 0; padding-left: 20px;">
                    <li>Account information</li>
                    <li>Trip details and locations</li>
                    <li>Friend connections</li>
                    <li>Achievements and statistics</li>
                    <li>Comments and messages</li>
                </ul>
                <p>The export will be downloaded as a JSON file that you can save and review.</p>
            `;

            modalConfirm.textContent = 'Export Data';
            modalConfirm.classList.remove('hidden');
            modal.classList.remove('hidden');

            // Handle confirmation
            const handleConfirm = async () => {
                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                modal.classList.add('hidden');
                
                await this.performDataExport();
            };

            const handleCancel = () => {
                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                modal.classList.add('hidden');
            };

            modalConfirm.addEventListener('click', handleConfirm);
            modalCancel.addEventListener('click', handleCancel);

        } catch (error) {
            console.error('Export error:', error);
            this.showError('Failed to export data. Please try again.');
        }
    }

    // Perform the actual data export (mirrors Flutter implementation)
    async performDataExport() {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No authenticated user found');
        }

        try {
            this.showLoading('Exporting your data...');

            const exportData = {
                exportTimestamp: new Date().toISOString(),
                userId: user.uid,
                accountInfo: {},
                userProfile: {},
                trips: [],
                friendships: [],
                achievements: {},
                comments: [],
                invitations: [],
                statistics: {}
            };

            // 1. Account Information
            exportData.accountInfo = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified,
                creationTime: user.metadata.creationTime,
                lastSignInTime: user.metadata.lastSignInTime
            };

            // 2. User Profile Data
            try {
                const userProfileDoc = await firestore.collection('users').doc(user.uid).get();
                if (userProfileDoc.exists) {
                    exportData.userProfile = this.sanitizeForJson(userProfileDoc.data());
                }
            } catch (e) {
                console.warn('Failed to export user profile:', e);
            }

            // 3. Export all other data
            exportData.trips = await this.exportTripsData(user.uid);
            exportData.friendships = await this.exportFriendshipsData(user.uid);
            exportData.achievements = await this.exportAchievementsData(user.uid);
            exportData.comments = await this.exportCommentsData(user.uid);
            exportData.invitations = await this.exportInvitationsData(user.uid);
            exportData.statistics = await this.exportStatisticsData(user.uid);

            // Download the data
            this.downloadJson(exportData, `yamu-data-export-${user.uid}-${Date.now()}.json`);
            
            this.showSuccess('Data exported successfully!');

        } catch (error) {
            console.error('Failed to export user data:', error);
            this.showError('Failed to export data: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // Sanitize data for JSON export (handle Firestore Timestamps)
    sanitizeForJson(data) {
        if (data == null) return null;
        
        if (data.toDate && typeof data.toDate === 'function') {
            // Firestore Timestamp
            return data.toDate().toISOString();
        }
        
        if (data instanceof Date) {
            return data.toISOString();
        }
        
        if (typeof data === 'object' && !Array.isArray(data)) {
            const sanitized = {};
            Object.entries(data).forEach(([key, value]) => {
                sanitized[key] = this.sanitizeForJson(value);
            });
            return sanitized;
        }
        
        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeForJson(item));
        }
        
        return data;
    }

    // Export trips data
    async exportTripsData(userId) {
        const trips = [];
        
        try {
            const [ownerTrips, participantTrips] = await Promise.all([
                firestore.collection('road_trips').where('ownerUid', '==', userId).get(),
                firestore.collection('road_trips').where('participants', 'array-contains', userId).get()
            ]);

            const processedIds = new Set();
            
            [ownerTrips, participantTrips].forEach(querySnapshot => {
                querySnapshot.docs.forEach(doc => {
                    if (!processedIds.has(doc.id)) {
                        processedIds.add(doc.id);
                        const tripData = doc.data();
                        tripData.id = doc.id;
                        trips.push(this.sanitizeForJson(tripData));
                    }
                });
            });

        } catch (error) {
            console.warn('Failed to export trips data:', error);
        }

        return trips;
    }

    // Export friendships data
    async exportFriendshipsData(userId) {
        const friendships = [];
        
        try {
            const friendshipsQuery = await firestore
                .collection('friendships')
                .where('users', 'array-contains', userId)
                .where('status', '==', 'active')
                .get();

            friendshipsQuery.docs.forEach(doc => {
                const friendshipData = doc.data();
                friendshipData.id = doc.id;
                friendships.push(this.sanitizeForJson(friendshipData));
            });
        } catch (error) {
            console.warn('Failed to export friendships data:', error);
        }

        return friendships;
    }

    // Export achievements data
    async exportAchievementsData(userId) {
        try {
            const achievementsDoc = await firestore.collection('achievements').doc(userId).get();
            if (achievementsDoc.exists) {
                return this.sanitizeForJson(achievementsDoc.data());
            }
            return {};
        } catch (error) {
            console.warn('Failed to export achievements data:', error);
            return {};
        }
    }

    // Export comments data
    async exportCommentsData(userId) {
        const comments = [];
        
        try {
            const commentsQuery = await firestore
                .collectionGroup('comments')
                .where('userId', '==', userId)
                .get();

            commentsQuery.docs.forEach(doc => {
                const commentData = doc.data();
                commentData.id = doc.id;
                commentData.path = doc.ref.path;
                comments.push(this.sanitizeForJson(commentData));
            });
        } catch (error) {
            console.warn('Failed to export comments data:', error);
        }

        return comments;
    }

    // Export invitations data
    async exportInvitationsData(userId) {
        const invitations = [];
        
        try {
            // Sent invitations
            const sentQuery = await firestore
                .collection('invitations')
                .where('senderId', '==', userId)
                .get();

            sentQuery.docs.forEach(doc => {
                const inviteData = doc.data();
                inviteData.id = doc.id;
                inviteData.type = 'sent';
                invitations.push(this.sanitizeForJson(inviteData));
            });

            // Received invitations
            if (auth.currentUser?.email) {
                const receivedQuery = await firestore
                    .collection('invitations')
                    .where('receiverEmail', '==', auth.currentUser.email)
                    .get();

                receivedQuery.docs.forEach(doc => {
                    const inviteData = doc.data();
                    inviteData.id = doc.id;
                    inviteData.type = 'received';
                    invitations.push(this.sanitizeForJson(inviteData));
                });
            }
        } catch (error) {
            console.warn('Failed to export invitations data:', error);
        }

        return invitations;
    }

    // Export statistics data
    async exportStatisticsData(userId) {
        try {
            const statisticsDoc = await firestore.collection('travelStats').doc(userId).get();
            if (statisticsDoc.exists) {
                return this.sanitizeForJson(statisticsDoc.data());
            }
            return {};
        } catch (error) {
            console.warn('Failed to export statistics data:', error);
            return {};
        }
    }

    // Download JSON data as file
    downloadJson(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    // Handle account deletion
    async handleAccountDeletion() {
        try {
            const modal = document.getElementById('modal');
            const modalTitle = document.getElementById('modal-title');
            const modalMessage = document.getElementById('modal-message');
            const modalConfirm = document.getElementById('modal-confirm');
            const modalCancel = document.getElementById('modal-cancel');

            modalTitle.textContent = '⚠️ Delete Your Account';
            modalMessage.innerHTML = `
                <div class="error-message">
                    <p><strong>This action cannot be undone!</strong></p>
                    <p>Deleting your account will permanently remove:</p>
                    <ul style="margin: 16px 0; padding-left: 20px;">
                        <li>Your profile and account information</li>
                        <li>All your trips and travel history</li>
                        <li>Friend connections and invitations</li>
                        <li>Achievements and statistics</li>
                        <li>Comments and messages</li>
                    </ul>
                    <p><strong>Please type "delete my account" to confirm:</strong></p>
                    <input type="text" id="delete-confirmation" placeholder="Type: delete my account" 
                           style="width: 100%; padding: 8px; margin: 8px 0; border: 1px solid #ccc; border-radius: 4px;">
                </div>
            `;

            modalConfirm.textContent = 'Delete Account';
            modalConfirm.classList.remove('hidden');
            modalConfirm.classList.add('btn-danger');
            modal.classList.remove('hidden');

            // Handle confirmation
            const handleConfirm = async () => {
                const confirmationInput = document.getElementById('delete-confirmation');
                const confirmationText = confirmationInput?.value?.trim().toLowerCase();
                
                if (confirmationText !== 'delete my account') {
                    this.showError('Please type "delete my account" exactly to confirm.');
                    return;
                }

                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                modal.classList.add('hidden');
                
                await this.performAccountDeletion();
            };

            const handleCancel = () => {
                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                modal.classList.add('hidden');
            };

            modalConfirm.addEventListener('click', handleConfirm);
            modalCancel.addEventListener('click', handleCancel);

        } catch (error) {
            console.error('Delete error:', error);
            this.showError('Failed to initiate account deletion. Please try again.');
        }
    }

    // Perform account deletion (mirrors Flutter implementation)
    async performAccountDeletion() {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No authenticated user found');
        }

        try {
            this.showLoading('Deleting your account...');

            const userId = user.uid;
            const batch = firestore.batch();

            // 1. Remove user from trips as participant
            await this.removeUserFromTrips(userId, batch);

            // 2. Handle owned trips
            await this.handleOwnedTrips(userId, batch);

            // 3. Delete friendships
            await this.deleteFriendships(userId, batch);

            // 4. Delete achievements
            await this.deleteAchievements(userId, batch);

            // 5. Delete comments
            await this.deleteComments(userId, batch);

            // 6. Delete invitations
            await this.deleteInvitations(userId, batch);

            // 7. Delete user profile
            batch.delete(firestore.collection('users').doc(userId));

            // 8. Delete statistics
            await this.deleteStatistics(userId, batch);

            // Execute all Firestore deletions
            await batch.commit();

            // 9. Finally, delete the Firebase Auth account
            await user.delete();

            this.showSuccess('Your account has been successfully deleted.');
            
            // Redirect after a delay
            setTimeout(() => {
                window.location.href = 'https://yamu.app';
            }, 3000);

        } catch (error) {
            console.error('Failed to delete user account:', error);
            this.showError('Failed to delete account: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // Helper methods for account deletion (mirror Flutter implementation)
    async removeUserFromTrips(userId, batch) {
        const tripsQuery = await firestore
            .collection('road_trips')
            .where('participants', 'array-contains', userId)
            .get();

        tripsQuery.docs.forEach(doc => {
            const tripData = doc.data();
            const participants = [...(tripData.participants || [])];
            const index = participants.indexOf(userId);
            if (index > -1) {
                participants.splice(index, 1);
            }
            batch.update(doc.ref, { participants });
        });
    }

    async handleOwnedTrips(userId, batch) {
        const ownedTripsQuery = await firestore
            .collection('road_trips')
            .where('ownerUid', '==', userId)
            .get();

        ownedTripsQuery.docs.forEach(doc => {
            const tripData = doc.data();
            const participants = [...(tripData.participants || [])];
            
            if (participants.length > 1) {
                // Transfer ownership to another participant
                const newOwner = participants.find(uid => uid !== userId);
                if (newOwner) {
                    batch.update(doc.ref, { ownerUid: newOwner });
                }
            } else {
                // Delete the trip if no other participants
                batch.delete(doc.ref);
            }
        });
    }

    async deleteFriendships(userId, batch) {
        const friendshipsQuery = await firestore
            .collection('friendships')
            .where('users', 'array-contains', userId)
            .get();

        friendshipsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }

    async deleteAchievements(userId, batch) {
        const achievementsRef = firestore.collection('achievements').doc(userId);
        batch.delete(achievementsRef);
    }

    async deleteComments(userId, batch) {
        const commentsQuery = await firestore
            .collectionGroup('comments')
            .where('userId', '==', userId)
            .get();

        commentsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }

    async deleteInvitations(userId, batch) {
        // Delete sent invitations
        const sentInvitationsQuery = await firestore
            .collection('invitations')
            .where('senderId', '==', userId)
            .get();

        sentInvitationsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete received invitations
        if (auth.currentUser?.email) {
            const receivedInvitationsQuery = await firestore
                .collection('invitations')
                .where('receiverEmail', '==', auth.currentUser.email)
                .get();

            receivedInvitationsQuery.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
    }

    async deleteStatistics(userId, batch) {
        const statisticsRef = firestore.collection('travelStats').doc(userId);
        batch.delete(statisticsRef);
    }

    // UI Helper methods
    showLoading(message) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const modalConfirm = document.getElementById('modal-confirm');

        modalTitle.textContent = 'Processing...';
        modalMessage.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
        modalConfirm.classList.add('hidden');
        modal.classList.remove('hidden');
    }

    hideLoading() {
        const modal = document.getElementById('modal');
        modal.classList.add('hidden');
    }

    showSuccess(message) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const modalConfirm = document.getElementById('modal-confirm');

        modalTitle.textContent = '✅ Success';
        modalMessage.innerHTML = `<div class="success-message"><p>${message}</p></div>`;
        modalConfirm.classList.add('hidden');
        modal.classList.remove('hidden');
    }

    showError(message) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const modalConfirm = document.getElementById('modal-confirm');

        modalTitle.textContent = '❌ Error';
        modalMessage.innerHTML = `<div class="error-message"><p>${message}</p></div>`;
        modalConfirm.classList.add('hidden');
        modal.classList.remove('hidden');
    }
}

// Initialize account manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.accountManager = new AccountManager();
});