package br.com.wsoubar.jubarte.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import br.com.wsoubar.jubarte.model.Usuario;
import br.com.wsoubar.jubarte.repository.UsuarioRepository;

@Service
public class UsuarioServiceImpl implements UsuarioService {

    @Autowired
    private UsuarioRepository usuRepo;

    @Override
    public List<Usuario> getAllUsuarios() {
        // return Streamable.of(usuRepo.findAll()).toList();
        return usuRepo.findAll();
    }

    @Override
    public void save(Usuario usuario) {
        usuRepo.save(usuario);
    }

    @Override
    public Usuario getById(Long id) {
        Optional<Usuario> optional = usuRepo.findById(id);
        Usuario usuario = null;
        if (optional.isPresent()) {
            usuario = optional.get();
        } else {
            throw new RuntimeException("Usuario not found for id : " + id);
        }
        return usuario;
    }

    @Override
    public void deleteById(long id) {
        usuRepo.deleteById(id);
    }
    
}
