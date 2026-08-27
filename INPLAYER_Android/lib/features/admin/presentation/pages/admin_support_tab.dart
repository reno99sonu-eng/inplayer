import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/admin_support_ticket.dart';
import '../../../../services/admin_service.dart';

class AdminSupportTab extends ConsumerStatefulWidget {
  const AdminSupportTab({super.key});

  @override
  ConsumerState<AdminSupportTab> createState() => _AdminSupportTabState();
}

class _AdminSupportTabState extends ConsumerState<AdminSupportTab> {
  String _domain = 'inplayer'; // 'inplayer' | 'hammart'
  String? _status; // null | 'open' | 'in_progress' | 'ai_resolved' | 'resolved' | 'abandoned'
  bool _loading = true;
  List<AdminSupportTicket> _tickets = [];
  Map<String, int> _counts = {};
  bool _tableMissing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getSupportTickets(
          domain: _domain,
          status: _status,
        );
    if (!mounted) return;
    setState(() {
      _tickets = result.tickets;
      _counts = result.counts;
      _tableMissing = result.tableMissing;
      _loading = false;
    });
  }

  Future<void> _changeTicketStatus(AdminSupportTicket ticket) async {
    final statuses = [
      ('open', 'Open'),
      ('in_progress', 'In Progress'),
      ('resolved', 'Resolved'),
      ('abandoned', 'Abandoned'),
    ];

    String selectedStatus = ticket.status;
    final notesController = TextEditingController(text: ticket.adminNotes ?? '');

    final updated = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          decoration: BoxDecoration(
            color: ctx.bgModal,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: ctx.borderSubtle),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Update Ticket', style: TextStyle(color: ctx.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
                  IconButton(
                    icon: Icon(Icons.close, color: ctx.textDim, size: 20),
                    onPressed: () => Navigator.pop(ctx, false),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text('Status', style: TextStyle(color: ctx.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: statuses.map((s) {
                  final isSelected = selectedStatus == s.$1;
                  return ChoiceChip(
                    label: Text(s.$2),
                    selected: isSelected,
                    onSelected: (_) => setSheetState(() => selectedStatus = s.$1),
                    selectedColor: AppColors.brandOrange,
                    backgroundColor: ctx.bgCard,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : ctx.textSecondary,
                      fontWeight: FontWeight.bold,
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              Text('Admin Notes', style: TextStyle(color: ctx.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              TextField(
                controller: notesController,
                maxLines: 3,
                style: TextStyle(color: ctx.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Add internal notes or resolution summary...',
                  hintStyle: TextStyle(color: ctx.textDim, fontSize: 13),
                  filled: true,
                  fillColor: ctx.bgCard,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: ctx.borderSubtle)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () async {
                    final ok = await ref.read(adminServiceProvider).updateSupportTicketStatus(
                          ticket.ticketId,
                          selectedStatus,
                          adminNotes: notesController.text.trim(),
                        );
                    if (ctx.mounted) Navigator.pop(ctx, ok);
                  },
                  child: const Text('Save Status', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (updated == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Support ticket updated.')),
      );
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_tableMissing) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.support_agent_outlined, size: 48, color: context.textDim),
              const SizedBox(height: 12),
              Text('Support Desk Table Not Initialized', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Text('The support tickets table in DynamoDB has not been created yet.', textAlign: TextAlign.center, style: TextStyle(color: context.textSecondary, fontSize: 12)),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: context.bgCanvas,
      body: RefreshIndicator(
        color: AppColors.brandOrange,
        backgroundColor: context.bgCard,
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildDomainToggle(context),
                    const SizedBox(height: 12),
                    _buildStatusTabs(context),
                  ],
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
              )
            else if (_tickets.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.mark_chat_read_outlined, size: 48, color: context.textDim),
                      const SizedBox(height: 12),
                      Text('No tickets found', style: TextStyle(color: context.textSecondary)),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildTicketCard(context, _tickets[index]),
                    childCount: _tickets.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDomainToggle(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () {
                if (_domain != 'inplayer') {
                  setState(() => _domain = 'inplayer');
                  _load();
                }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: _domain == 'inplayer' ? AppColors.brandOrange : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    'InPlayer Desk',
                    style: TextStyle(
                      color: _domain == 'inplayer' ? Colors.white : context.textSecondary,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () {
                if (_domain != 'hammart') {
                  setState(() => _domain = 'hammart');
                  _load();
                }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: _domain == 'hammart' ? const Color(0xFF10B981) : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    'Hammart Desk',
                    style: TextStyle(
                      color: _domain == 'hammart' ? Colors.white : context.textSecondary,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusTabs(BuildContext context) {
    final tabs = [
      (key: null, label: 'All (${_counts['total'] ?? 0})'),
      (key: 'open', label: 'Open (${_counts['open'] ?? 0})'),
      (key: 'in_progress', label: 'In Progress (${_counts['in_progress'] ?? 0})'),
      (key: 'ai_resolved', label: 'AI Resolved (${_counts['ai_resolved'] ?? 0})'),
      (key: 'resolved', label: 'Resolved (${_counts['resolved'] ?? 0})'),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: tabs.map((tab) {
          final isSelected = _status == tab.key;
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: ChoiceChip(
              label: Text(tab.label),
              selected: isSelected,
              onSelected: (_) {
                setState(() => _status = tab.key);
                _load();
              },
              selectedColor: AppColors.brandOrange,
              backgroundColor: context.bgCard,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : context.textSecondary,
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              ),
              side: BorderSide(color: isSelected ? AppColors.brandOrange : context.borderSubtle),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTicketCard(BuildContext context, AdminSupportTicket ticket) {
    Color statusColor;
    switch (ticket.status) {
      case 'open':
        statusColor = const Color(0xFFEF4444);
        break;
      case 'in_progress':
        statusColor = const Color(0xFFF59E0B);
        break;
      case 'ai_resolved':
      case 'resolved':
        statusColor = const Color(0xFF10B981);
        break;
      default:
        statusColor = context.textDim;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    ticket.status.toUpperCase().replaceAll('_', ' '),
                    style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                  ),
                ],
              ),
              GestureDetector(
                onTap: () => _changeTicketStatus(ticket),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.brandOrange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      Text('Action', style: TextStyle(color: AppColors.brandOrangeLight, fontSize: 11, fontWeight: FontWeight.bold)),
                      const SizedBox(width: 2),
                      Icon(Icons.arrow_drop_down, color: AppColors.brandOrangeLight, size: 16),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            ticket.query,
            style: TextStyle(color: context.textPrimary, fontSize: 13, fontWeight: FontWeight.w700),
          ),
          if (ticket.aiResponse != null && ticket.aiResponse!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: context.isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.smart_toy_outlined, color: AppColors.brandOrangeLight, size: 14),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      ticket.aiResponse!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: context.textSecondary, fontSize: 11, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                ticket.userName ?? ticket.userEmail ?? 'Guest User',
                style: TextStyle(color: context.textDim, fontSize: 11),
              ),
              Text(
                ticket.createdAt.split('T').first,
                style: TextStyle(color: context.textDim, fontSize: 10),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
