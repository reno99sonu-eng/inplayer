import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

class FilmSearchBar extends StatefulWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback? onClear;
  final String hintText;

  const FilmSearchBar({
    super.key,
    required this.controller,
    required this.onChanged,
    this.onClear,
    this.hintText = 'Search micro-series, dramas...',
  });

  @override
  State<FilmSearchBar> createState() => _FilmSearchBarState();
}

class _FilmSearchBarState extends State<FilmSearchBar> {
  late stt.SpeechToText _speech;
  bool _speechEnabled = false;
  bool _isListening = false;

  @override
  void initState() {
    super.initState();
    _speech = stt.SpeechToText();
    _initSpeech();
  }

  Future<void> _initSpeech() async {
    try {
      _speechEnabled = await _speech.initialize(
        onError: (val) {
          if (mounted) setState(() => _isListening = false);
        },
        onStatus: (val) {
          if (val == 'done' || val == 'notListening') {
            if (mounted) setState(() => _isListening = false);
          }
        },
      );
      if (mounted) setState(() {});
    } catch (_) {
      _speechEnabled = false;
    }
  }

  Future<void> _toggleListening() async {
    if (!_speechEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Voice recognition is not available on this device'),
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    if (_isListening) {
      await _speech.stop();
      if (mounted) setState(() => _isListening = false);
    } else {
      setState(() => _isListening = true);
      await _speech.listen(
        onResult: (result) {
          if (result.recognizedWords.isNotEmpty) {
            widget.controller.text = result.recognizedWords;
            widget.onChanged(result.recognizedWords);
          }
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(24),
        border: _isListening
            ? Border.all(color: const Color(0xFFFF7A18), width: 1.5)
            : null,
        boxShadow: _isListening
            ? [
                BoxShadow(
                  color: const Color(0xFFFF7A18).withValues(alpha: 0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: Row(
        children: [
          const SizedBox(width: 14),
          Icon(Icons.search, size: 20, color: Colors.white54),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: widget.controller,
              onChanged: widget.onChanged,
              style: TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: _isListening ? 'Listening...' : widget.hintText,
                hintStyle: TextStyle(
                  color: _isListening
                      ? const Color(0xFFFF7A18)
                      : Colors.white38,
                  fontSize: 14,
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
          if (widget.controller.text.isNotEmpty)
            IconButton(
              icon: Icon(Icons.close, size: 18, color: Colors.white54),
              onPressed: () {
                widget.controller.clear();
                widget.onChanged('');
                widget.onClear?.call();
              },
            ),
          GestureDetector(
            onTap: _toggleListening,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.all(8),
              margin: const EdgeInsets.only(right: 6),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _isListening
                    ? const Color(0xFFFF7A18)
                    : Colors.transparent,
              ),
              child: Icon(
                _isListening ? Icons.mic : Icons.mic_none,
                size: 20,
                color: _isListening ? Colors.white : Colors.white70,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
