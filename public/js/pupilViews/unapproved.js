ready(function () {
    'use strict';

    var $dialogContent;

    if (!window.pupilViews.unapprovedView) {
        window.pupilViews.unapprovedView = new UnapprovedView();
    } else {
        window.pupilViews.unapprovedView = null;
        $(document).off('click', '#saveSettings');
        $(document).off('click', '.settings-list-item.editable');
        $(document).off('click', '#sendRequestBtn');
        $(document).off('click', '#saveRequest');
        $(document).off('change', '#profileInput');
        window.pupilViews.unapprovedView = new UnapprovedView();
    }
    $dialogContent = $('.view-dialog-content').detach();

    function UnapprovedView() {
        var settingView;

        $(document).on('click', '#saveSettings', saveSettings);
        $(document).on('click', '.settings-list-item.editable', openSettingsDialog);
        $(document).on('change', '#profileInput', profileInputChange);
        $(document).on('click', '.getTestFile', getTestFile)

        function getTestFile(e) {
            e.preventDefault();
            loadingStart()
            var url = $(this).attr('href');
            var auth = JSON.parse(window.localStorage.getItem('jquery.oauth'))
            var examNumber = url.split('/').pop()
            var xhr = new XMLHttpRequest();
            var filename = 'exam-result-' + examNumber + '.png';
            if ($(e.target).hasClass('getTestFileKey')) {
                filename = url.split('/').pop();
            }
            
            xhr.onreadystatechange = function(){
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        downloadFile(this.response, filename)
                    }
                    if (this.status == 401) {
                        $(document).trigger('lyceum:needReload');
                    }
                }
            }
            xhr.open('GET', url);
            xhr.setRequestHeader('Authorization', 'Bearer ' + auth.accessToken);
            xhr.responseType = 'blob';
            xhr.send();
        }

        function downloadFile(data, filename) {
            var a = document.createElement('a');
            var url = window.URL.createObjectURL(data);
            a.href = url;
            a.download = filename;
            document.body.append(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            loadingEnd();
        }

        function saveSettings() {
            var data = {};
            if (settingView === 'profile') {
                var $profileInput = $('#profileInput');
                if ($profileInput.val() !== 'Выберите профиль') {
                    data = {
                        profile: $profileInput.val(),
                        needBel: $('#profileBel').prop('checked')
                    };
                    updateProfile(data);
                }
            }
        }

        function profileInputChange() {
            var selectedOption = $('#profileInput')[0].selectedOptions[0];
            $('#profileBelLabel')[0].MaterialCheckbox.uncheck();
            if ($(selectedOption).data('bel')) {
                $('#belLang')
                    .removeClass('hiddenView')
                    .addClass('visibleView');
            } else {
                $('#belLang')
                    .removeClass('visibleView')
                    .addClass('hiddenView');
            }
        }

        function openSettingsDialog(e) {
            e.preventDefault();
            e.stopPropagation();
            settingView = $(e.currentTarget).attr('href');
            $('.dialog__actions-for-phone').hide();
            $('.dialog__actions-for-everything').hide();
            if (settingView === 'logout') {
                $(document).trigger('lyceum:logout');
            } else {
                $('.dialog__actions-for-everything').show();
                $(document).trigger('lyceum:openDialog', $dialogContent.find('#' + settingView).html());
            }
        }


        function updateProfile(data) {
            $.ajax({
                url: '/api/pupils/profile',
                method: 'POST',
                data: data,
                statusCode: {
                    200: function (response) {
                        if (response.message === 'ok') {
                            var pupil = response.pupil;
                            //TODO loadingEnd();
                            $('#profileInput').val(pupil.profile);
                            $(document).trigger('lyceum:showNotification', 'Профиль изменён.');
                            $(document).trigger('lyceum:needReload');
                        } else {
                            //  auth.login(response.access_token, response.refresh_token);
                            // signInView.hide();
                            //  getUser();
                        }
                    },
                    403: function (response) {
                        console.log(response);
                        //TODO Error handle
                        if (response.responseText === '{"error":"invalid_grant","error_description":"Invalid resource owner credentials"}') {
                            loadingEnd();
                            $('#loginPassInput').val('');
                            showUserNotFoundError();
                        }
                    }
                }
            });
        }
    }
});