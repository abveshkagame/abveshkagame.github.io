(function () {
    'use strict';

    if (window.lampa_combo_online_ready) return;
    window.lampa_combo_online_ready = true;

    var FILMIX_URL = 'https://lampaplugins.github.io/store/fx.js';
    var REZKA_URL  = 'https://abveshkagame.github.io/rezka-source.js?v=2';

    // Наше рабочее зеркало Rezka
    var REZKA_DOMAIN = 'https://tv.hdrezka.inc';

    function loadScript(url, callback) {
        var script = document.createElement('script');

        script.src = url;
        script.async = true;

        script.onload = function () {
            callback && callback(true);
        };

        script.onerror = function () {
            console.log('LAMPA ONLINE COMBO: failed to load', url);
            callback && callback(false);
        };

        document.head.appendChild(script);
    }

    function filmixButton(root) {
        var found = null;

        root.find('.view--online').each(function () {
            var subtitle = ($(this).attr('data-subtitle') || '').toLowerCase();

            if (subtitle.indexOf('filmix') !== -1) {
                found = $(this);
                return false;
            }
        });

        return found;
    }

    function rezkaButton(root) {
        var btn = root.find('.view--rezka');
        return btn.length ? btn.eq(0) : null;
    }

    function openProviders(root) {
        var filmix = filmixButton(root);
        var rezka  = rezkaButton(root);

        var html = $('<div class="combo-online-select"></div>');

        function addProvider(title, providerButton) {
            var item = $(
                '<div class="selector menu__item" style="' +
                'padding:1em 1.2em;' +
                'margin-bottom:.6em;' +
                'border-radius:.4em;' +
                'background:rgba(255,255,255,.08);' +
                'font-size:1.25em;' +
                '">' + title + '</div>'
            );

            if (!providerButton || !providerButton.length) {
                item.css('opacity', '0.45');

                item.on('hover:enter', function () {
                    Lampa.Noty.show(title + ': источник не загрузился');
                });
            }
            else {
                item.on('hover:enter', function () {
                    Lampa.Modal.close();

                    setTimeout(function () {
                        providerButton.trigger('hover:enter');
                    }, 100);
                });
            }

            html.append(item);
        }

        addProvider('Filmix', filmix);
        addProvider('HDRezka', rezka);

        Lampa.Modal.open({
            title: 'Онлайн',
            html: html,
            size: 'small',

            onBack: function () {
                Lampa.Modal.close();
                Lampa.Controller.toggle('content');
            }
        });
    }

    function installComboButton() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            // Даём Filmix и Rezka время добавить свои кнопки.
            setTimeout(function () {
                var root = e.object.activity.render();

                var filmix = filmixButton(root);
                var rezka  = rezkaButton(root);

                // Их собственные кнопки остаются рабочими,
                // но пользователь их больше не видит.
                if (filmix) filmix.hide();
                if (rezka) rezka.hide();

                if (root.find('.view--online-combo').length) return;

                var container = root.find('.full-start-new__buttons');
                if (!container.length) container = root.find('.full-start__buttons');

                if (!container.length) return;

                var button = $(
                    '<div class="full-start__button selector view--online-combo">' +
                        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">' +
                            '<path d="M8 5v14l11-7L8 5z" fill="currentColor"/>' +
                        '</svg>' +
                        '<span>Онлайн</span>' +
                    '</div>'
                );

                button.on('hover:enter', function () {
                    openProviders(root);
                });

                container.prepend(button);
            }, 150);
        });
    }

    function start() {
        try {
            // Если домен Rezka ещё не задан пользователем,
            // сразу ставим рабочее зеркало.
            var currentDomain = Lampa.Storage.get('rezka_domain', '');

            if (!currentDomain || currentDomain === 'https://rezka.fi') {
                Lampa.Storage.set('rezka_domain', REZKA_DOMAIN);
            }
        }
        catch (e) {}

        // Filmix
        loadScript(FILMIX_URL, function () {
            // затем Rezka
            loadScript(REZKA_URL, function () {
                installComboButton();

                console.log(
                    'LAMPA ONLINE COMBO: Filmix + HDRezka loaded'
                );
            });
        });
    }

    function bootstrap() {
        if (typeof Lampa === 'undefined') {
            return setTimeout(bootstrap, 200);
        }

        if (window.appready) {
            start();
        }
        else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') start();
            });
        }
    }

    bootstrap();
})();
